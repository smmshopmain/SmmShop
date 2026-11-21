import { NextRequest } from "next/server";
import { runResellerApiRequest } from "@/lib/reseller-api";
import { ApiRequestLog, Order } from "@/models";

export async function GET(request: NextRequest) {
  return runResellerApiRequest(request, "rest", {}, "usage.read", async ({ user }) => {
    const [requestCount, failedRequests, averageDuration, orders] = await Promise.all([
      ApiRequestLog.countDocuments({ user: user._id }),
      ApiRequestLog.countDocuments({ user: user._id, success: false }),
      ApiRequestLog.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: null, averageMs: { $avg: "$durationMs" } } },
      ]),
      Order.aggregate([
        { $match: { user: user._id, source: "api" } },
        { $group: { _id: "$status", count: { $sum: 1 }, spending: { $sum: "$sellingPrice" } } },
      ]),
    ]);
    return {
      requests: requestCount,
      failedRequests,
      errorPercentage: requestCount ? Math.round((failedRequests / requestCount) * 10000) / 100 : 0,
      averageResponseTimeMs: Math.round(averageDuration[0]?.averageMs ?? 0),
      orders: orders.reduce((sum, item) => sum + item.count, 0),
      totalApiCharges: orders
        .filter((item) => !["Failed", "Refunded"].includes(String(item._id)))
        .reduce((sum, item) => sum + item.spending, 0),
      ordersByStatus: Object.fromEntries(orders.map((item) => [item._id, item.count])),
    };
  });
}
