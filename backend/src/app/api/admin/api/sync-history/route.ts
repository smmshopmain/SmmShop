import { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { ApiRequestLog, User, getSettings } from "@/models";

const SYNC_ACTIONS = ["services.auto_sync", "services.manual_sync", "services.sync", "services.import"];

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();
    if (!(await getSettings()).api.enabled) return fail("Reseller API is currently disabled.", 404);

    const params = request.nextUrl.searchParams;
    const pageValue = Number(params.get("page") ?? 1);
    const page = Number.isInteger(pageValue) ? Math.min(Math.max(pageValue, 1), 10000) : 1;
    const filter: Record<string, unknown> = { action: { $in: SYNC_ACTIONS } };
    const userId = params.get("userId")?.trim();
    if (userId) filter.user = userId;
    const query = params.get("q")?.trim().slice(0, 100);
    if (query) {
      const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const users = await User.find({ $or: [{ name: new RegExp(safe, "i") }, { email: new RegExp(safe, "i") }] })
        .select("_id")
        .limit(100)
        .lean();
      filter.$and = [{
        $or: [
          { endpoint: new RegExp(safe, "i") },
          { action: new RegExp(safe, "i") },
          { errorCode: new RegExp(safe, "i") },
          { ip: new RegExp(safe, "i") },
          { user: { $in: users.map((user) => user._id) } },
        ],
      }];
    }
    const success = params.get("success");
    if (success === "true") filter.success = true;
    if (success === "false") filter.success = false;
    const from = params.get("from");
    const to = params.get("to");
    if (from || to) {
      const createdAt: Record<string, Date> = {};
      if (from) {
        const parsed = new Date(from);
        if (Number.isNaN(parsed.getTime())) return fail("Invalid start date.", 400);
        createdAt.$gte = parsed;
      }
      if (to) {
        const parsed = new Date(to);
        if (Number.isNaN(parsed.getTime())) return fail("Invalid end date.", 400);
        if (/^\d{4}-\d{2}-\d{2}$/.test(to)) parsed.setHours(23, 59, 59, 999);
        createdAt.$lte = parsed;
      }
      filter.createdAt = createdAt;
    }

    const [logs, total] = await Promise.all([
      ApiRequestLog.find(filter)
        .populate("user", "name email")
        .populate("apiKey", "name prefix")
        .sort({ createdAt: -1 })
        .skip((page - 1) * 50)
        .limit(50)
        .lean(),
      ApiRequestLog.countDocuments(filter),
    ]);
    return ok({ logs, page, limit: 50, total, pages: Math.ceil(total / 50) });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load API sync history", 403);
  }
}
