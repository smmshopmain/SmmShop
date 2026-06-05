import { fail, ok, requireAdmin } from "@/lib/api";
import { Order } from "@/models";
import { NextRequest } from "next/server";

function daysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function dateFilter(from?: string | null, to?: string | null) {
  const createdAt: Record<string, Date> = {};
  if (from) createdAt.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    createdAt.$lte = end;
  }
  return Object.keys(createdAt).length ? { createdAt } : {};
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const rangeMatch = dateFilter(searchParams.get("from"), searchParams.get("to"));
    const [daily, weekly, monthly, topServices, topCustomers] = await Promise.all([
      revenueSince(daysAgo(1)),
      revenueSince(daysAgo(7)),
      revenueSince(daysAgo(30)),
      Order.aggregate([
        { $match: rangeMatch },
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
        {
          $project: {
            name: "$service.name",
            category: "$service.category",
            orders: 1,
            revenue: 1,
            profit: 1,
          },
        },
      ]),
      Order.aggregate([
        { $match: rangeMatch },
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
        {
          $project: {
            name: "$user.name",
            email: "$user.email",
            orders: 1,
            revenue: 1,
            profit: 1,
          },
        },
      ]),
    ]);

    return ok({ daily, weekly, monthly, topServices, topCustomers });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load analytics", 403);
  }
}

async function revenueSince(date: Date) {
  const [result] = await Order.aggregate([
    { $match: { createdAt: { $gte: date } } },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        revenue: { $sum: "$sellingPrice" },
        providerCost: { $sum: "$providerCost" },
        profit: { $sum: "$profit" },
      },
    },
  ]);

  return {
    orders: result?.orders ?? 0,
    revenue: result?.revenue ?? 0,
    providerCost: result?.providerCost ?? 0,
    profit: result?.profit ?? 0,
  };
}
