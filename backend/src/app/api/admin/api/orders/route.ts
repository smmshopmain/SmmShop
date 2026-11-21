import { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { Order, WalletTransaction, getSettings } from "@/models";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();
    if (!(await getSettings()).api.enabled) return fail("Reseller API is currently disabled.", 404);

    const params = request.nextUrl.searchParams;
    const pageValue = Number(params.get("page") ?? 1);
    const limitValue = Number(params.get("limit") ?? 50);
    const page = Number.isInteger(pageValue) ? Math.min(Math.max(pageValue, 1), 10000) : 1;
    const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 100) : 50;
    const filter: Record<string, unknown> = { source: "api" };
    const status = params.get("status")?.trim();
    if (status) filter.status = status.slice(0, 40);
    const userId = params.get("userId")?.trim();
    if (userId) filter.user = userId;
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

    const query = params.get("q")?.trim().slice(0, 100);
    if (query) {
      const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { link: new RegExp(safe, "i") },
        { providerOrderId: new RegExp(safe, "i") },
        ...( /^[a-f\d]{24}$/i.test(query) ? [{ _id: query }] : []),
      ];
    }

    const [orders, total, statuses] = await Promise.all([
      Order.find(filter)
        .populate("user", "name email")
        .populate("service", "name category")
        .populate("apiKey", "name prefix")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
      Order.aggregate([
        { $match: { source: "api" } },
        { $group: { _id: "$status", count: { $sum: 1 }, charges: { $sum: "$sellingPrice" } } },
      ]),
    ]);
    const refunded = await WalletTransaction.distinct("reference", {
      type: "refund",
      reference: { $in: orders.map((order) => String(order._id)) },
    });
    const refundSet = new Set(refunded);
    return ok({
      orders: orders.map((order) => ({
        ...order,
        hasRefund: refundSet.has(String(order._id)),
        apiKeyName: order.apiKey && typeof order.apiKey === "object" ? (order.apiKey as { name?: string }).name : undefined,
      })),
      stats: statuses.map((item) => ({
        status: item._id,
        count: item.count,
        charges: item.charges,
      })),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load API orders", 403);
  }
}
