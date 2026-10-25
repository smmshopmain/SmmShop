import { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api";
import { Ticket, User } from "@/models";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const priority = params.get("priority");
    const query = params.get("q")?.trim();
    const filter: Record<string, unknown> = {};
    if (status && ["Open", "Answered", "Closed"].includes(status)) filter.status = status;
    if (priority && ["Low", "Medium", "High"].includes(priority)) filter.priority = priority;
    if (query) {
      const pattern = new RegExp(escapeRegExp(query), "i");
      const matchingUsers = await User.find({
        $or: [{ name: pattern }, { email: pattern }, { phone: pattern }],
      })
        .select("_id")
        .limit(300)
        .lean();
      filter.$or = [
        { subject: pattern },
        { category: pattern },
        { user: { $in: matchingUsers.map((user) => user._id) } },
      ];
    }

    const tickets = await Ticket.find(filter)
      .populate("user", "name email phone")
      .sort({ updatedAt: -1 })
      .limit(300)
      .lean();
    return ok({ tickets });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load tickets", 403);
  }
}
