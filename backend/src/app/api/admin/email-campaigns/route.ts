import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { SERVICE_PLATFORMS } from "@/lib/service-platforms";
import { EmailCampaign, Service, User } from "@/models";

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(["announcement", "advertisement"]),
  subject: z.string().trim().min(1).max(200),
  greeting: z.string().trim().max(200).default("Hello {{name}},"),
  body: z.string().trim().min(1).max(10000),
  serviceIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(10).default([]),
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
      .select("title kind subject greeting body services includeUnsubscribed scheduledAt status recipientCount sentCount failedCount lastError createdAt")
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
    const { sendNow, serviceIds, ...campaignInput } = input;
    const scheduledAt = sendNow ? new Date() : new Date(input.scheduledAt);
    if (!Number.isFinite(scheduledAt.getTime())) return fail("Choose a valid sending date and time.");
    if (!sendNow && scheduledAt.getTime() <= Date.now()) {
      return fail("Choose a future time or select Send now.");
    }

    const recipientCutoffAt = new Date();
    const recipients = {
      createdAt: { $lte: recipientCutoffAt },
      ...(input.includeUnsubscribed ? {} : { marketingUnsubscribed: { $ne: true } }),
    };
    const recipientCount = await User.countDocuments(recipients);
    const selectedServices = serviceIds.length
      ? await Service.find({ _id: { $in: serviceIds }, active: true })
          .select("name category sellingRate type min max")
          .lean()
      : [];
    if (selectedServices.length !== serviceIds.length) {
      return fail("One or more selected services are no longer active. Refresh the service list and try again.");
    }
    const serviceById = new Map(selectedServices.map((service) => [String(service._id), service]));
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
        sellingRate: service.sellingRate,
        type: service.type ?? "",
        min: service.min ?? 1,
        max: service.max ?? 100000,
      };
    });
    const campaign = await EmailCampaign.create({
      ...campaignInput,
      services,
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
