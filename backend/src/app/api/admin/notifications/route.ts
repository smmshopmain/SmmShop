import { fail, ok, requireAdmin } from "@/lib/api";
import { Notification } from "@/models";

export async function GET() {
  try {
    await requireAdmin();
    const notifications = await Notification.find()
      .populate("user", "email")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return ok({ notifications });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load notifications", 403);
  }
}
