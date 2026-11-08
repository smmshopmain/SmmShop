import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { requireCronOrAdmin } from "@/lib/cron";
import { buildCampaignEmail, createUnsubscribeToken } from "@/lib/email-marketing";
import { sendMail } from "@/lib/email";
import { EmailCampaign, getSettings, UploadedFile, User } from "@/models";

const CAMPAIGN_BATCH_SIZE = 25;
const LOCK_DURATION_MS = 5 * 60 * 1000;

function campaignUploadFileName(url: string) {
  const match = /^\/api\/uploads\/file\/campaign-banners\/([a-f\d-]+\.(?:jpg|png|webp))$/i.exec(url);
  return match?.[1] ?? null;
}

async function cleanupSentCampaignBanners(campaign: {
  _id: unknown;
  banner?: { imageUrl?: string; backgroundImageUrl?: string } | null;
}) {
  const urls = [...new Set([campaign.banner?.imageUrl, campaign.banner?.backgroundImageUrl].filter(
    (url): url is string => Boolean(url),
  ))];
  if (!urls.length) return;

  const activeCampaigns = await EmailCampaign.find({
    _id: { $ne: campaign._id },
    status: { $in: ["scheduled", "queued", "sending"] },
    $or: [
      { "banner.imageUrl": { $in: urls } },
      { "banner.backgroundImageUrl": { $in: urls } },
    ],
  })
    .select("banner.imageUrl banner.backgroundImageUrl")
    .lean();
  const activeUrls = new Set(
    activeCampaigns.flatMap((item) => [item.banner?.imageUrl, item.banner?.backgroundImageUrl])
      .filter((url): url is string => Boolean(url)),
  );
  const unusedUrls = urls.filter((url) => !activeUrls.has(url));
  const fileNames = unusedUrls.map(campaignUploadFileName).filter((name): name is string => Boolean(name));

  if (fileNames.length) {
    await UploadedFile.deleteMany({ folder: "campaign-banners", fileName: { $in: fileNames } });
  }

  await EmailCampaign.updateOne(
    { _id: campaign._id },
    {
      $unset: {
        "banner.imageUrl": 1,
        "banner.backgroundImageUrl": 1,
      },
      $set: { bannerCleanupError: null },
    },
  );
}

export async function POST(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  try {
    await dbConnect();
    const now = new Date();
    const campaign = await EmailCampaign.findOneAndUpdate(
      {
        status: { $in: ["scheduled", "queued", "sending"] },
        scheduledAt: { $lte: now },
        $or: [{ lockUntil: { $exists: false } }, { lockUntil: null }, { lockUntil: { $lt: now } }],
      },
      { $set: { status: "sending", lockUntil: new Date(now.getTime() + LOCK_DURATION_MS) } },
      { sort: { scheduledAt: 1 }, new: true },
    );
    if (!campaign) return ok({ processed: false, message: "No due email campaigns." });

    const settings = await getSettings();
    const query: Record<string, unknown> = {
      ...(campaign.includeUnsubscribed ? {} : { marketingUnsubscribed: { $ne: true } }),
      ...(campaign.audienceMode === "selected"
        ? { _id: { $in: campaign.recipientUserIds ?? [] } }
        : { createdAt: { $lte: campaign.recipientCutoffAt } }),
    };
    if (campaign.cursor) {
      if (campaign.audienceMode === "selected") {
        query._id = {
          $in: campaign.recipientUserIds ?? [],
          $gt: campaign.cursor,
        };
      } else {
        query._id = { $gt: campaign.cursor };
      }
    }
    const recipients = await User.find(query)
      .sort({ _id: 1 })
      .limit(CAMPAIGN_BATCH_SIZE)
      .select("_id name email")
      .lean();

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const siteUrl = process.env.FRONTEND_URL?.trim() || process.env.APP_BASE_URL?.trim();
    const backendUrl = process.env.APP_BASE_URL?.trim();
    if (!siteUrl || !backendUrl) throw new Error("FRONTEND_URL and APP_BASE_URL must be configured for campaign links.");

    for (let index = 0; index < recipients.length; index += 5) {
      const batch = recipients.slice(index, index + 5);
      const results = await Promise.all(
        batch.map(async (recipient) => {
          const unsubscribeUrl = `${backendUrl.replace(/\/+$/, "")}/api/email/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(String(recipient._id)))}`;
          try {
            const email = buildCampaignEmail({
              subject: campaign.subject,
              greeting: campaign.greeting,
              body: campaign.body,
              recipientName: recipient.name,
              recipientEmail: recipient.email,
              services: campaign.services ?? [],
              brandName: settings.email.brandName,
              primaryColor: settings.email.primaryColor,
              accentColor: settings.email.accentColor,
              siteUrl,
              backendUrl,
              unsubscribeUrl,
              banner: campaign.banner,
            });
            await sendMail({ to: recipient.email, ...email });
            return null;
          } catch (error) {
            return error instanceof Error ? error.message : "Email delivery failed";
          }
        }),
      );
      let batchSent = 0;
      let batchFailed = 0;
      for (const result of results) {
        if (result === null) {
          sent += 1;
          batchSent += 1;
        } else {
          failed += 1;
          batchFailed += 1;
          errors.push(result);
        }
      }
      const completedRecipients = batch.at(-1);
      if (completedRecipients) {
        await EmailCampaign.updateOne(
          { _id: campaign._id },
          {
            $inc: { sentCount: batchSent, failedCount: batchFailed },
            $set: {
              cursor: completedRecipients._id,
              lockUntil: new Date(Date.now() + LOCK_DURATION_MS),
            },
          },
        );
      }
    }

    const lastRecipient = recipients.at(-1);
    const hasMore = lastRecipient
      ? await User.exists({
          ...query,
          _id: campaign.audienceMode === "selected"
            ? { $in: campaign.recipientUserIds ?? [], $gt: lastRecipient._id }
            : { $gt: lastRecipient._id },
        })
      : false;

    const status = hasMore ? "queued" : failed ? (sent ? "partial" : "failed") : "sent";
    await EmailCampaign.updateOne(
      { _id: campaign._id },
      {
        $set: {
          lastError: errors.length ? errors.slice(0, 3).join("; ").slice(0, 1000) : null,
          lockUntil: null,
          status,
        },
      },
    );

    let cleanupWarning: string | undefined;
    if (status === "sent") {
      try {
        await cleanupSentCampaignBanners(campaign);
      } catch (error) {
        cleanupWarning = error instanceof Error ? error.message : "Unable to delete campaign banner uploads.";
        console.error("Email campaign sent, but banner cleanup failed", {
          campaignId: String(campaign._id),
          error,
        });
        await EmailCampaign.updateOne(
          { _id: campaign._id },
          { $set: { bannerCleanupError: cleanupWarning } },
        );
      }
    }

    return ok({
      processed: true,
      campaignId: campaign._id,
      batchSize: recipients.length,
      sent,
      failed,
      hasMore: Boolean(hasMore),
      status,
      ...(cleanupWarning ? { cleanupWarning } : {}),
    });
  } catch (error) {
    console.error("Email campaign batch failed", error);
    return fail(error instanceof Error ? error.message : "Unable to process email campaign", 500);
  }
}
