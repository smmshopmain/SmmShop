import Link from "next/link";
import { BadgeIndianRupee, Banknote, ShoppingBag, Users } from "lucide-react";
import { ActionButton } from "@/components/admin-controls";
import { AdminHeader } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { requireAdmin } from "@/lib/auth";
import { Deposit, Order, Provider, User } from "@/models";

export default async function AdminPage() {
  let stats = {
    totalUsers: 0,
    activeUsers: 0,
    totalOrders: 0,
    todaysOrders: 0,
    revenue: 0,
    profit: 0,
    deposits: 0,
    pendingDeposits: 0,
    providerBalance: 0,
  };

  try {
    await requireAdmin();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [totalUsers, activeUsers, totalOrders, todaysOrders, deposits, pendingDeposits, providers, revenue] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isBanned: false }),
        Order.countDocuments(),
        Order.countDocuments({ createdAt: { $gte: today } }),
        Deposit.countDocuments(),
        Deposit.countDocuments({ status: "Pending" }),
        Provider.find().lean(),
        Order.aggregate([{ $group: { _id: null, revenue: { $sum: "$sellingPrice" }, profit: { $sum: "$profit" } } }]),
      ]);
    stats = {
      totalUsers,
      activeUsers,
      totalOrders,
      todaysOrders,
      deposits,
      pendingDeposits,
      providerBalance: providers.reduce((sum, provider) => sum + (provider.balance ?? 0), 0),
      revenue: revenue[0]?.revenue ?? 0,
      profit: revenue[0]?.profit ?? 0,
    };
  } catch {
    stats = { ...stats };
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Operations overview"
        title="Admin dashboard"
        description="Users, orders, revenue, deposits, profit, and provider health in one clean console."
        actions={
          <>
            <Link href="/admin/settings#payment-details" className="rounded-md bg-teal-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-800">
              Payment setup
            </Link>
            <ActionButton label="Sync orders" endpoint="/api/cron/status-sync" method="GET" />
            <ActionButton label="Sync refills" endpoint="/api/cron/refill-sync" method="GET" />
            <ActionButton label="Sync balances" endpoint="/api/cron/provider-balance" method="GET" />
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Users" value={stats.totalUsers} icon={Users} />
        <StatCard label="Active Users" value={stats.activeUsers} icon={Users} tone="neutral" />
        <StatCard label="Total Orders" value={stats.totalOrders} icon={ShoppingBag} tone="amber" />
        <StatCard label="Today's Orders" value={stats.todaysOrders} icon={ShoppingBag} />
        <StatCard label="Revenue" value={`Rs.${stats.revenue}`} icon={Banknote} />
        <StatCard label="Profit" value={`Rs.${stats.profit}`} icon={BadgeIndianRupee} tone="amber" />
        <StatCard label="Deposits" value={stats.deposits} icon={Banknote} tone="neutral" />
        <StatCard label="Pending Deposits" value={stats.pendingDeposits} icon={Banknote} tone="rose" />
        <StatCard label="Provider Balance" value={`Rs.${stats.providerBalance}`} icon={Banknote} />
      </div>
    </AppShell>
  );
}
