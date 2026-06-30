import { BadgeIndianRupee, Banknote, ShoppingBag } from "lucide-react";
import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
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

function dateFilter(from?: string, to?: string) {
  const createdAt: Record<string, Date> = {};
  if (from) createdAt.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    createdAt.$lte = end;
  }
  return Object.keys(createdAt).length ? { createdAt } : {};
}

export default async function AnalyticsPage({ searchParams }: { searchParams?: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const from = params?.from ?? "";
  const to = params?.to ?? "";
  let daily = { orders: 0, revenue: 0, profit: 0 };
  let weekly = daily;
  let monthly = daily;
  let topServices: Array<{ _id: string; name?: string; orders: number; revenue: number; profit: number }> = [];
  let topCustomers: Array<{ _id: string; name?: string; email?: string; orders: number; revenue: number; profit: number }> = [];

  try {
    await requireAdmin();
    const rangeMatch = dateFilter(from, to);
    [daily, weekly, monthly, topServices, topCustomers] = await Promise.all([
      revenueSince(1),
      revenueSince(7),
      revenueSince(30),
      Order.aggregate([
        { $match: rangeMatch },
        { $group: { _id: "$service", orders: { $sum: 1 }, revenue: { $sum: "$sellingPrice" }, profit: { $sum: "$profit" } } },
        { $sort: { orders: -1 } },
        { $limit: 10 },
        { $lookup: { from: "services", localField: "_id", foreignField: "_id", as: "service" } },
        { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
        { $project: { name: "$service.name", orders: 1, revenue: 1, profit: 1 } },
      ]),
      Order.aggregate([
        { $match: rangeMatch },
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
      <AdminHeader
        eyebrow="Business intelligence"
        title="Analytics"
        description="Revenue, profit, top services, and top customers by selected period."
        actions={
          <form className="grid gap-2 sm:grid-cols-[150px_150px_auto_auto]" action="/admin/analytics">
        <input name="from" type="date" defaultValue={from} className="h-11 rounded-md border border-neutral-300 px-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10" />
        <input name="to" type="date" defaultValue={to} className="h-11 rounded-md border border-neutral-300 px-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10" />
        <button className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">Apply</button>
        <a
          href={`/api/admin/analytics/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-center text-sm font-semibold hover:bg-neutral-50"
        >
          Export CSV
        </a>
      </form>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Daily revenue" value={`Rs.${daily.revenue}`} icon={Banknote} />
        <StatCard label="Weekly profit" value={`Rs.${weekly.profit}`} icon={BadgeIndianRupee} tone="amber" />
        <StatCard label="Monthly orders" value={monthly.orders} icon={ShoppingBag} tone="neutral" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminSection title="Top services" description="Highest order volume in the selected range" icon={ShoppingBag}>
          {topServices.map((service) => (
            <div key={String(service._id)} className="grid gap-2 border-b border-neutral-100 p-4 text-sm md:grid-cols-[1fr_80px_100px]">
              <span>
                <span className="block font-medium">{service.name ?? "Service"}</span>
                <span className="mt-2 block h-2 rounded-md bg-neutral-100">
                  <span className="block h-2 rounded-md bg-teal-700" style={{ width: `${Math.min(100, service.orders * 10)}%` }} />
                </span>
              </span>
              <span>{service.orders} orders</span>
              <strong>Rs.{service.profit}</strong>
            </div>
          ))}
          {topServices.length === 0 && <AdminEmptyState icon={ShoppingBag} title="No service data yet" description="Order activity will populate this report." />}
        </AdminSection>
        <AdminSection title="Top customers" description="Highest revenue customers in the selected range" icon={BadgeIndianRupee}>
          {topCustomers.map((customer) => (
            <div key={String(customer._id)} className="grid gap-2 border-b border-neutral-100 p-4 text-sm md:grid-cols-[1fr_80px_100px]">
              <span>
                <span className="block font-medium">{customer.name ?? "Customer"}</span>
                <span className="text-neutral-500">{customer.email}</span>
                <span className="mt-2 block h-2 rounded-md bg-neutral-100">
                  <span className="block h-2 rounded-md bg-amber-600" style={{ width: `${Math.min(100, customer.orders * 10)}%` }} />
                </span>
              </span>
              <span>{customer.orders} orders</span>
              <strong>Rs.{customer.revenue}</strong>
            </div>
          ))}
          {topCustomers.length === 0 && <AdminEmptyState icon={BadgeIndianRupee} title="No customer data yet" description="Customer revenue data will appear after orders are placed." />}
        </AdminSection>
      </div>
    </AppShell>
  );
}
