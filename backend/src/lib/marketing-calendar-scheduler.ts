import { CAMPAIGN_BANNER_PRESETS, suggestCampaignBannerPreset } from "@/lib/campaign-banners";
import { buildBrandedCampaignImagePrompt, generateMarketingCalendarDraft } from "@/lib/marketing-calendar-drafts";
import { dbConnect } from "@/lib/db";
import { generateVelonaCampaignImage } from "@/lib/velona-image-generation";
import { EmailCampaign, MarketingCalendarScheduleRun, Service, UploadedFile, User } from "@/models";
import { SERVICE_PLATFORMS } from "@/lib/service-platforms";

const ACTIVE_RUN_STATUSES: readonly string[] = ["queued", "processing"];
const ACTIVE_ITEM_STATUSES: readonly string[] = [
  "queued",
  "drafting",
  "draft_ready",
  "generating_banner",
  "banner_ready",
  "campaign_ready",
  "scheduling",
];
const RUN_LOCK_MS = 4 * 60 * 1000;

type MarketingCalendarScheduleItem = {
  _id: unknown;
  calendarEventKey: string;
  title: string;
  date: string;
  category: string;
  description?: string;
  status: string;
  draft?: {
    title: string;
    subject: string;
    greeting: string;
    body: string;
    bannerPrompt?: string;
    primaryColor?: string;
    accentColor?: string;
    presetId?: string | null;
  };
  bannerImageUrl?: string;
};

function platformForService(name: string, category: string) {
  const text = `${name} ${category}`.toLowerCase();
  return SERVICE_PLATFORMS.find((platform) =>
    platform.keywords.some((keyword) => text.includes(keyword)),
  )?.label ?? "Other";
}

async function updateItem(
  runId: unknown,
  itemId: unknown,
  fields: Record<string, unknown>,
) {
  const updates: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(fields)) {
    updates[`items.$.${field}`] = value;
  }
  await MarketingCalendarScheduleRun.updateOne(
    { _id: runId, "items._id": itemId },
    { $set: updates },
  );
}

async function discardUnusedBanner(imageUrl: string) {
  const match = /^\/api\/uploads\/file\/campaign-banners\/([a-f\d-]+\.(?:jpg|png|webp))$/i.exec(imageUrl);
  if (!match) return;
  const used = await EmailCampaign.exists({
    $or: [
      { "banner.imageUrl": imageUrl },
      { "banner.backgroundImageUrl": imageUrl },
    ],
  });
  if (!used) {
    await UploadedFile.deleteOne({ folder: "campaign-banners", fileName: match[1] });
  }
}

async function createScheduledCampaign(run: {
  _id: unknown;
  createdBy: unknown;
  generateBanner?: boolean;
  items: MarketingCalendarScheduleItem[];
}, item: MarketingCalendarScheduleItem) {
  const shouldGenerateBanner = run.generateBanner !== false;
  if (!item.draft || (shouldGenerateBanner && !item.bannerImageUrl)) {
    throw new Error("The generated campaign draft or enabled banner is missing.");
  }
  if (await EmailCampaign.exists({ calendarEventKey: item.calendarEventKey })) {
    if (item.bannerImageUrl) await discardUnusedBanner(item.bannerImageUrl);
    await updateItem(run._id, item._id, { status: "skipped", error: "An email campaign is already scheduled for this occasion." });
    return;
  }

  const services = await Service.aggregate([
    { $match: { active: true } },
    { $sample: { size: 5 } },
    { $project: { name: 1, category: 1, sellingRate: 1, type: 1, min: 1, max: 1 } },
  ]);
  if (services.length !== 5) throw new Error(`Only ${services.length} active services were available; exactly five are required.`);

  const recipientCutoffAt = new Date();
  const recipientFilter = {
    marketingUnsubscribed: { $ne: true },
    createdAt: { $lte: recipientCutoffAt },
  };
  const recipientCount = await User.countDocuments(recipientFilter);
  if (!recipientCount) throw new Error("No eligible subscribed email recipients were found.");

  const [year, month, day] = item.date.split("-").map(Number);
  let scheduledAt = new Date(Date.UTC(year, month - 1, day, 4, 30));
  if (scheduledAt.getTime() <= Date.now()) scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
  const campaignServices = services.map((service) => ({
    serviceId: String(service._id),
    name: service.name,
    category: service.category,
    platform: platformForService(service.name, service.category),
    country: "",
    sellingRate: service.sellingRate,
    type: service.type ?? "",
    min: service.min ?? 1,
    max: service.max ?? 100000,
  }));
  let campaign;
  try {
    campaign = await EmailCampaign.create({
      title: item.draft.title,
      kind: "advertisement",
      subject: item.draft.subject,
      greeting: item.draft.greeting,
      body: item.draft.body,
      primaryColor: item.draft.primaryColor || undefined,
      accentColor: item.draft.accentColor || undefined,
      banner: shouldGenerateBanner
        ? {
            presetId: item.draft.presetId ?? null,
            imageUrl: item.bannerImageUrl ?? "",
            backgroundImageUrl: "",
            backgroundColor: "",
          }
        : { presetId: null, imageUrl: "", backgroundImageUrl: "", backgroundColor: "" },
      calendarEventKey: item.calendarEventKey,
      services: campaignServices,
      audienceMode: "all",
      recipientUserIds: [],
      includeUnsubscribed: false,
      scheduledAt,
      recipientCutoffAt,
      recipientCount,
      status: "scheduled",
      createdBy: run.createdBy,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      if (item.bannerImageUrl) await discardUnusedBanner(item.bannerImageUrl);
      await updateItem(run._id, item._id, {
        status: "skipped",
        error: "Another campaign was scheduled for this occasion at the same time.",
      });
      return;
    }
    throw error;
  }
  await updateItem(run._id, item._id, {
    status: "scheduled",
    campaignId: campaign._id,
    error: "",
  });
}

async function updateRunStatus(runId: unknown) {
  const run = await MarketingCalendarScheduleRun.findById(runId).select("items.status").lean();
  if (!run) throw new Error("Calendar scheduling run was not found.");
  const pending = run.items.some((item: Pick<MarketingCalendarScheduleItem, "status">) =>
    typeof item.status === "string" && ACTIVE_ITEM_STATUSES.includes(item.status),
  );
  const failed = run.items.filter((item: Pick<MarketingCalendarScheduleItem, "status">) =>
    item.status === "failed",
  ).length;
  const status = pending
    ? "processing"
    : failed === run.items.length
      ? "failed"
      : failed
        ? "partial"
        : "completed";
  await MarketingCalendarScheduleRun.updateOne(
    { _id: runId },
    { $set: { status, lockUntil: null } },
  );
  return status;
}

export async function processNextMarketingCalendarScheduleRun() {
  await dbConnect();
  const now = new Date();
  const run = await MarketingCalendarScheduleRun.findOneAndUpdate(
    {
      status: { $in: ACTIVE_RUN_STATUSES },
      "items.status": { $in: ACTIVE_ITEM_STATUSES },
      $or: [
        { lockUntil: { $exists: false } },
        { lockUntil: null },
        { lockUntil: { $lt: now } },
      ],
    },
    { $set: { status: "processing", lockUntil: new Date(now.getTime() + RUN_LOCK_MS) } },
    { sort: { createdAt: 1 }, new: true },
  );
  if (!run) return { processed: false, message: "No calendar scheduling jobs are waiting." };

  const item = run.items.find((candidate: MarketingCalendarScheduleItem) =>
    typeof candidate.status === "string" && ACTIVE_ITEM_STATUSES.includes(candidate.status),
  );
  if (!item) {
    const status = await updateRunStatus(run._id);
    return { processed: true, runId: String(run._id), status };
  }

  try {
    if (item.status === "queued" || item.status === "drafting") {
      await updateItem(run._id, item._id, { status: "drafting" });
      if (await EmailCampaign.exists({ calendarEventKey: item.calendarEventKey })) {
        await updateItem(run._id, item._id, {
          status: "skipped",
          error: "An email campaign is already scheduled for this occasion.",
        });
      } else {
        const draft = await generateMarketingCalendarDraft({
          title: item.title,
          date: item.date,
          category: item.category,
          description: item.description ?? "",
          instructions: run.instructions ?? "",
          brandName: run.brandName,
          generateBanner: run.generateBanner !== false,
        });
        const shouldGenerateBanner = run.generateBanner !== false;
        const presetId = shouldGenerateBanner
          ? suggestCampaignBannerPreset("advertisement", item.title, draft.email.subject, draft.email.body)
          : null;
        if (shouldGenerateBanner && !presetId) throw new Error("Unable to choose a campaign banner design.");
        const preset = presetId ? CAMPAIGN_BANNER_PRESETS[presetId] : null;
        await updateItem(run._id, item._id, {
          status: shouldGenerateBanner ? "draft_ready" : "campaign_ready",
          draft: {
            ...draft.email,
            presetId,
            ...(preset ? { primaryColor: preset.colors[0], accentColor: preset.colors[1] } : {}),
          },
          error: "",
        });
      }
    } else if (item.status === "draft_ready" || item.status === "generating_banner") {
      await updateItem(run._id, item._id, { status: "generating_banner" });
      if (!item.draft?.bannerPrompt) throw new Error("The generated advertisement image prompt is missing.");
      const imageUrl = await generateVelonaCampaignImage({
        prompt: buildBrandedCampaignImagePrompt({
          brandName: run.brandName,
          title: item.title,
          date: item.date,
          context: item.description ?? item.category,
          bannerPrompt: item.draft.bannerPrompt,
        }),
        folder: "campaign-banners",
        createdBy: String(run.createdBy),
      });
      await updateItem(run._id, item._id, {
        status: "banner_ready",
        bannerImageUrl: imageUrl,
        error: "",
      });
    } else {
      await updateItem(run._id, item._id, { status: "scheduling" });
      await createScheduledCampaign(run, item);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to schedule this occasion.";
    console.error("Marketing calendar scheduling item failed.", {
      runId: String(run._id),
      eventKey: item.calendarEventKey,
      error,
    });
    if (item.bannerImageUrl) {
      try {
        await discardUnusedBanner(item.bannerImageUrl);
      } catch (cleanupError) {
        console.error("Unable to clean up an unused calendar campaign banner.", cleanupError);
      }
    }
    await updateItem(run._id, item._id, { status: "failed", error: message.slice(0, 1000) });
  }

  const status = await updateRunStatus(run._id);
  return {
    processed: true,
    runId: String(run._id),
    eventKey: item.calendarEventKey,
    status,
  };
}
