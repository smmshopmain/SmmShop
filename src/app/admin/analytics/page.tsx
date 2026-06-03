import { BadgeIndianRupee, Banknote, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { requireAdmin } from "@/lib/auth";
import { Order } from "@/models";

async function revenueSince(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  const [result] = await Order.aggregate([
    { $match: { createdAt: { $gte: date } } },
    { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: "$sellingPrice" }, profit: { $sum: "$profit" } } },
  ]);
  return { orders: result?.orders ?? 0, revenue: result?.revenue ?? 0, profit: result?.profit ?? 0 };
}

export default async function AnalyticsPage() {
  let daily = { orders: 0, revenue: 0, profit: 0 };
  let weekly = daily;
  let monthly = daily;
  let topServices: Array<{ _id: string; name?: string; orders: number; revenue: number; profit: number }> = [];
  let topCustomers: Array<{ _id: string; name?: string; email?: string; orders: number; revenue: number; profit: number }> = [];

  try {
    await requireAdmin();
    [daily, weekly, monthly, topServices, topCustomers] = await Promise.all([
      revenueSince(1),
      revenueSince(7),
      revenueSince(30),
      Order.aggregate([
        { $group: { _id: "$service", orders: { $sum: 1 }, revenue: { $sum: "$sellingPrice" }, profit: { $sum: "$profit" } } },
        { $sort: { orders: -1 } },
        { $limit: 10 },
        { $lookup: { from: "services", localField: "_id", foreignField: "_id", as: "service" } },
        { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
        { $project: { name: "$service.name", orders: 1, revenue: 1, profit: 1 } },
      ]),
      Order.aggregate([
        { $group: { _id: "$user", orders: { $sum: 1 }, revenue: { $sum: "$sellingPrice" }, profit: { $sum: "$profit" } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        { $project: { name: "$user.name", email: "$user.email", orders: 1, revenue: 1, profit: 1 } },
      ]),
    ]);
  } catch {
    topServices = [];
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-neutral-600">Revenue, profit, top services, and top customers.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Daily revenue" value={`Rs.${daily.revenue}`} icon={Banknote} />
        <StatCard label="Weekly profit" value={`Rs.${weekly.profit}`} icon={BadgeIndianRupee} tone="amber" />
        <StatCard label="Monthly orders" value={monthly.orders} icon={ShoppingBag} tone="neutral" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 p-4">
            <h2 className="font-semibold">Top services</h2>
          </div>
          {topServices.map((service) => (
            <div key={String(service._id)} className="grid gap-2 border-b border-neutral-100 p-4 text-sm md:grid-cols-[1fr_80px_100px]">
              <span className="font-medium">{service.name ?? "Service"}</span>
              <span>{service.orders} orders</span>
              <strong>Rs.{service.profit}</strong>
            </div>
          ))}
          {topServices.length === 0 && <p className="p-4 text-sm text-neutral-500">No service data yet.</p>}
        </section>
        <section className="rounded-md border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 p-4">
            <h2 className="font-semibold">Top customers</h2>
          </div>
          {topCustomers.map((customer) => (
            <div key={String(customer._id)} className="grid gap-2 border-b border-neutral-100 p-4 text-sm md:grid-cols-[1fr_80px_100px]">
              <span>
                <span className="block font-medium">{customer.name ?? "Customer"}</span>
                <span className="text-neutral-500">{customer.email}</span>
              </span>
              <span>{customer.orders} orders</span>
              <strong>Rs.{customer.revenue}</strong>
            </div>
          ))}
          {topCustomers.length === 0 && <p className="p-4 text-sm text-neutral-500">No customer data yet.</p>}
        </section>
      </div>
    </AppShell>
  );
}
