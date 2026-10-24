import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { requireCronOrAdmin } from "@/lib/cron";
import { buildCampaignEmail, createUnsubscribeToken } from "@/lib/email-marketing";
import { sendMail } from "@/lib/email";
import { EmailCampaign, getSettings, User } from "@/models";

const CAMPAIGN_BATCH_SIZE = 25;
const LOCK_DURATION_MS = 5 * 60 * 1000;

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
      createdAt: { $lte: campaign.recipientCutoffAt },
      ...(campaign.includeUnsubscribed ? {} : { marketingUnsubscribed: { $ne: true } }),
    };
    if (campaign.cursor) query._id = { $gt: campaign.cursor };
    const recipients = await User.find(query)
      .sort({ _id: 1 })
      .limit(CAMPAIGN_BATCH_SIZE)
      .select("_id email")
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
              body: campaign.body,
              brandName: settings.email.brandName,
              primaryColor: settings.email.primaryColor,
              accentColor: settings.email.accentColor,
              siteUrl,
              unsubscribeUrl,
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
          _id: { $gt: lastRecipient._id },
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

    return ok({
      processed: true,
      campaignId: campaign._id,
      batchSize: recipients.length,
      sent,
      failed,
      hasMore: Boolean(hasMore),
      status,
    });
  } catch (error) {
    console.error("Email campaign batch failed", error);
    return fail(error instanceof Error ? error.message : "Unable to process email campaign", 500);
  }
}
