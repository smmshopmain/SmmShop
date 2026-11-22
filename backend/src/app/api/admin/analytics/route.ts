import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { analyticsDateFilter, excludeRefundedOrderStages, InvalidAnalyticsDateRangeError } from "@/lib/analytics";
import { Order } from "@/models";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const rangeMatch = analyticsDateFilter(searchParams.get("from"), searchParams.get("to"));
    const [report] = await Order.aggregate([
      { $match: rangeMatch },
      ...excludeRefundedOrderStages(),
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                orders: { $sum: 1 },
                revenue: { $sum: "$sellingPrice" },
                profit: { $sum: "$profit" },
              },
            },
          ],
          topServices: [
            {
              $group: {
                _id: "$service",
                orders: { $sum: 1 },
                revenue: { $sum: "$sellingPrice" },
                profit: { $sum: "$profit" },
              },
            },
            { $sort: { orders: -1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: "services",
                localField: "_id",
                foreignField: "_id",
                as: "service",
              },
            },
            { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
            { $project: { name: "$service.name", category: "$service.category", orders: 1, revenue: 1, profit: 1 } },
          ],
          topCustomers: [
            {
              $group: {
                _id: "$user",
                orders: { $sum: 1 },
                revenue: { $sum: "$sellingPrice" },
                profit: { $sum: "$profit" },
              },
            },
            { $sort: { revenue: -1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user",
              },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            { $project: { name: "$user.name", email: "$user.email", orders: 1, revenue: 1, profit: 1 } },
          ],
        },
      },
    ]);

    return ok({
      summary: report?.summary?.[0] ?? { orders: 0, revenue: 0, profit: 0 },
      topServices: report?.topServices ?? [],
      topCustomers: report?.topCustomers ?? [],
    });
  } catch (error) {
    if (error instanceof InvalidAnalyticsDateRangeError) return fail(error.message, 400);
    if (error instanceof Error && error.message === "Unauthorized") return fail(error.message, 401);
    if (error instanceof Error && error.message === "Forbidden") return fail(error.message, 403);
    console.error("Admin analytics query failed.", error);
    return fail("Unable to load analytics", 500);
  }
}
