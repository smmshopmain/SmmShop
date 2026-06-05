import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { Notification } from "@/models";

const patchSchema = z.object({
  id: z.string().min(1).optional(),
  action: z.enum(["read", "read_all"]),
});

export async function GET() {
  try {
    const { auth } = await requireUser();
    const notifications = await Notification.find({ user: auth.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const unreadCount = await Notification.countDocuments({ user: auth.id, readAt: { $exists: false } });
    return ok({ notifications, unreadCount });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load notifications", 401);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const input = await parseBody(request, patchSchema);
    const { auth } = await requireUser();
    if (input.action === "read_all") {
      await Notification.updateMany({ user: auth.id, readAt: { $exists: false } }, { readAt: new Date() });
      return ok({ updated: true });
    }

    if (!input.id) return fail("Notification id is required");
    const notification = await Notification.findOneAndUpdate(
      { _id: input.id, user: auth.id },
      { readAt: new Date() },
      { returnDocument: "after" },
    );
    if (!notification) return fail("Notification not found", 404);
    return ok({ notification });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update notifications");
  }
}
