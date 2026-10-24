import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { EmailCampaign, User } from "@/models";

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(["announcement", "advertisement"]),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  includeUnsubscribed: z.boolean(),
  scheduledAt: z.string().datetime().or(z.date()),
});

export async function GET() {
  try {
    await requireAdmin();
    await dbConnect();
    const campaigns = await EmailCampaign.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .select("title kind subject includeUnsubscribed scheduledAt status recipientCount sentCount failedCount lastError createdAt")
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
    const scheduledAt = new Date(input.scheduledAt);
    if (!Number.isFinite(scheduledAt.getTime())) return fail("Choose a valid sending date and time.");

    const recipients = {
      createdAt: { $lte: new Date() },
      ...(input.includeUnsubscribed ? {} : { marketingUnsubscribed: { $ne: true } }),
    };
    const recipientCount = await User.countDocuments(recipients);
    const campaign = await EmailCampaign.create({
      ...input,
      scheduledAt,
      recipientCutoffAt: new Date(),
      recipientCount,
      status: scheduledAt.getTime() > Date.now() ? "scheduled" : "queued",
      createdBy: dbUser?._id,
    });
    return ok({ campaign });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create email campaign");
  }
}
