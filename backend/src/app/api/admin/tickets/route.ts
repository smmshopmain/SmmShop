import { fail, ok, requireAdmin } from "@/lib/api";
import { Ticket } from "@/models";

export async function GET() {
  try {
    await requireAdmin();
    const tickets = await Ticket.find()
      .populate("user", "name email")
      .sort({ updatedAt: -1 })
      .limit(150)
      .lean();
    return ok({ tickets });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load tickets", 403);
  }
}
