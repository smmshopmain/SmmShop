import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { CAMPAIGN_BANNER_PRESETS, type CampaignBannerPresetId } from "@/lib/campaign-banners";
import { SERVICE_PLATFORMS } from "@/lib/service-platforms";
import { EmailCampaign, Service, User } from "@/models";

const bannerPresetIds = Object.keys(CAMPAIGN_BANNER_PRESETS) as [CampaignBannerPresetId, ...CampaignBannerPresetId[]];
const schema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(["announcement", "advertisement"]),
  subject: z.string().trim().min(1).max(200),
  greeting: z.string().trim().max(200).default("Hello {{name}},"),
  body: z.string().trim().min(1).max(10000),
  banner: z.object({
    presetId: z.enum(bannerPresetIds).nullable(),
    imageUrl: z.string().trim().max(500),
    backgroundImageUrl: z.string().trim().max(500).default(""),
    backgroundColor: z.string().regex(/^$|^#[\da-f]{6}$/i).default(""),
  }).refine(
    ({ imageUrl, backgroundImageUrl, backgroundColor }) =>
      (!imageUrl || /^\/api\/uploads\/file\/campaign-banners\/[a-f\d-]+\.(?:jpg|png|webp)$/i.test(imageUrl)) &&
      (!backgroundImageUrl || (/^\/api\/uploads\/file\/campaign-banners\/[a-f\d-]+\.(?:jpg|png|webp)$/i.test(backgroundImageUrl) && Boolean(imageUrl))) &&
      (!backgroundColor || Boolean(imageUrl)),
    "Choose a valid festival design and custom banner, with an optional background.",
  ).default({ presetId: null, imageUrl: "", backgroundImageUrl: "", backgroundColor: "" }),
  serviceIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(10).default([]),
  serviceCountries: z.array(z.object({
    serviceId: z.string().regex(/^[a-f\d]{24}$/i),
    country: z.string().trim().max(80),
  })).max(10).default([]),
  audienceMode: z.enum(["all", "selected"]).default("all"),
  recipientUserIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(500).default([])
    .refine((ids) => new Set(ids).size === ids.length, "Selected recipients must be unique."),
  includeUnsubscribed: z.boolean(),
  sendNow: z.boolean().default(false),
  scheduledAt: z.string().datetime().or(z.date()),
});

export async function GET() {
  try {
    await requireAdmin();
    await dbConnect();
    const campaigns = await EmailCampaign.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .select("title kind subject greeting body banner services includeUnsubscribed audienceMode recipientUserIds scheduledAt status recipientCount sentCount failedCount lastError bannerCleanupError createdAt")
      .populate({ path: "recipientUserIds", select: "name email" })
      .lean();
    return ok({ campaigns });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load email campaigns", 403);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { dbUser } = await requireAdmin();
    await dbConnect();
    const input = await parseBody(request, schema);
    const { sendNow, serviceIds, serviceCountries, recipientUserIds, audienceMode, ...campaignInput } = input;
    const scheduledAt = sendNow ? new Date() : new Date(input.scheduledAt);
    if (!Number.isFinite(scheduledAt.getTime())) return fail("Choose a valid sending date and time.");
    if (!sendNow && scheduledAt.getTime() <= Date.now()) {
      return fail("Choose a future time or select Send now.");
    }

    const recipientCutoffAt = new Date();
    if (audienceMode === "selected" && recipientUserIds.length === 0) {
      return fail("Select at least one recipient for a specific-user campaign.");
    }

    const recipientFilter = {
      ...(input.includeUnsubscribed ? {} : { marketingUnsubscribed: { $ne: true } }),
      ...(audienceMode === "selected"
        ? { _id: { $in: recipientUserIds } }
        : { createdAt: { $lte: recipientCutoffAt } }),
    };
    const recipientCount = await User.countDocuments(recipientFilter);
    if (recipientCount === 0) return fail("No eligible recipients found for this campaign.");
    const selectedServices = serviceIds.length
      ? await Service.find({ _id: { $in: serviceIds }, active: true })
          .select("name category sellingRate type min max")
          .lean()
      : [];
    if (selectedServices.length !== serviceIds.length) {
      return fail("One or more selected services are no longer active. Refresh the service list and try again.");
    }
    const serviceById = new Map(selectedServices.map((service) => [String(service._id), service]));
    const countryById = new Map(serviceCountries.map(({ serviceId, country }) => [serviceId, country]));
    if (serviceCountries.some(({ serviceId }) => !serviceIds.includes(serviceId))) {
      return fail("Country selection references a service that is not included in this campaign.");
    }
    const services = serviceIds.map((serviceId) => {
      const service = serviceById.get(serviceId);
      if (!service) throw new Error("A selected service could not be loaded.");
      const platformText = `${service.name} ${service.category}`.toLowerCase();
      const platform = SERVICE_PLATFORMS.find((item) =>
        item.keywords.some((keyword) => platformText.includes(keyword)),
      )?.label ?? "Other";
      return {
        serviceId,
        name: service.name,
        category: service.category,
        platform,
        country: countryById.get(serviceId) ?? "",
        sellingRate: service.sellingRate,
        type: service.type ?? "",
        min: service.min ?? 1,
        max: service.max ?? 100000,
      };
    });
    const campaign = await EmailCampaign.create({
      ...campaignInput,
      services,
      audienceMode,
      recipientUserIds: audienceMode === "selected" ? recipientUserIds : [],
      scheduledAt,
      recipientCutoffAt,
      recipientCount,
      status: sendNow ? "queued" : "scheduled",
      createdBy: dbUser?._id,
    });
    return ok({ campaign });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create email campaign");
  }
}
