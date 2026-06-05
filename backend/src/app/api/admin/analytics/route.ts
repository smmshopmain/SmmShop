import { fail, ok, requireAdmin } from "@/lib/api";
import { Order } from "@/models";

function daysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

export async function GET() {
  try {
    await requireAdmin();
    const [daily, weekly, monthly, topServices, topCustomers] = await Promise.all([
      revenueSince(daysAgo(1)),
      revenueSince(daysAgo(7)),
      revenueSince(daysAgo(30)),
      Order.aggregate([
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
