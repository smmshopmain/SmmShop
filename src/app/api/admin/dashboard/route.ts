import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { Deposit, Order, Provider, User } from "@/models";

export async function GET() {
  try {
    await requireAdmin();
    await dbConnect();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      totalOrders,
      todaysOrders,
      deposits,
      pendingDeposits,
      providers,
      revenueAgg,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isBanned: false }),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Deposit.countDocuments(),
      Deposit.countDocuments({ status: "Pending" }),
      Provider.find().sort({ priority: 1 }).lean(),
      Order.aggregate([
        {
          $group: {
            _id: null,
            revenue: { $sum: "$sellingPrice" },
            profit: { $sum: "$profit" },
          },
        },
      ]),
    ]);

    return ok({
      totalUsers,
      activeUsers,
      totalOrders,
      todaysOrders,
      deposits,
      pendingDeposits,
      providerBalance: providers.reduce((sum, provider) => sum + (provider.balance ?? 0), 0),
      providers,
      revenue: revenueAgg[0]?.revenue ?? 0,
      profit: revenueAgg[0]?.profit ?? 0,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load dashboard", 403);
  }
}
