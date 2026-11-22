import { BadgeIndianRupee, Banknote, ShoppingBag } from "lucide-react";
import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { requireAdmin } from "@/lib/auth";
import { analyticsDateFilter, excludeRefundedOrderStages, InvalidAnalyticsDateRangeError } from "@/lib/analytics";
import { dbConnect } from "@/lib/db";
import { Order } from "@/models";

export default async function AnalyticsPage({ searchParams }: { searchParams?: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const from = params?.from ?? "";
  const to = params?.to ?? "";
  let summary = { orders: 0, revenue: 0, profit: 0 };
  let topServices: Array<{ _id: string; name?: string; providerServiceId?: string; orders: number; revenue: number; profit: number }> = [];
  let topCustomers: Array<{ _id: string; name?: string; email?: string; orders: number; revenue: number; profit: number }> = [];
  let loadError = "";

  try {
    await requireAdmin();
    await dbConnect();
    const rangeMatch = analyticsDateFilter(from, to);
    const [report] = await Order.aggregate([
      { $match: rangeMatch },
      ...excludeRefundedOrderStages(),
      {
        $facet: {
          summary: [
            { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: "$sellingPrice" }, profit: { $sum: "$profit" } } },
          ],
          topServices: [
            { $group: { _id: "$service", orders: { $sum: 1 }, revenue: { $sum: "$sellingPrice" }, profit: { $sum: "$profit" } } },
            { $sort: { orders: -1 } },
            { $limit: 10 },
            { $lookup: { from: "services", localField: "_id", foreignField: "_id", as: "service" } },
            { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
            { $project: { name: "$service.name", providerServiceId: "$service.providerServiceId", orders: 1, revenue: 1, profit: 1 } },
          ],
          topCustomers: [
            { $group: { _id: "$user", orders: { $sum: 1 }, revenue: { $sum: "$sellingPrice" }, profit: { $sum: "$profit" } } },
            { $sort: { revenue: -1 } },
            { $limit: 10 },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            { $project: { name: "$user.name", email: "$user.email", orders: 1, revenue: 1, profit: 1 } },
          ],
        },
      },
    ]);
    summary = report?.summary?.[0] ?? summary;
    topServices = report?.topServices ?? [];
    topCustomers = report?.topCustomers ?? [];
  } catch (error) {
    console.error("Unable to load admin analytics.", error);
    loadError = error instanceof InvalidAnalyticsDateRangeError
      ? error.message
      : "Analytics could not be loaded. Check your connection and try again.";
  }

  const maxServiceOrders = Math.max(1, ...topServices.map((service) => service.orders));
  const maxCustomerRevenue = Math.max(1, ...topCustomers.map((customer) => customer.revenue));
  const periodLabel = from || to ? `${from || "Start"} – ${to || "Today"}` : "All time";

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Business intelligence"
        title="Analytics"
        description={`Revenue, profit, orders, rankings, and export for ${periodLabel}. Refunded orders are excluded.`}
        actions={
          <form className="grid gap-2 sm:grid-cols-[150px_150px_auto_auto]" action="/admin/analytics">
            <input aria-label="From date" name="from" type="date" defaultValue={from} max={to || undefined} className="h-11 rounded-md border border-neutral-300 px-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10" />
            <input aria-label="To date" name="to" type="date" defaultValue={to} min={from || undefined} className="h-11 rounded-md border border-neutral-300 px-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10" />
            <button className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">Apply</button>
            <a href={`/api/admin/analytics/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-center text-sm font-semibold hover:bg-neutral-50">
              Export CSV
            </a>
          </form>
        }
      />
      {loadError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{loadError}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Revenue in period" value={`Rs.${summary.revenue.toFixed(2)}`} icon={Banknote} />
        <StatCard label="Profit in period" value={`Rs.${summary.profit.toFixed(2)}`} icon={BadgeIndianRupee} tone="amber" />
        <StatCard label="Orders in period" value={summary.orders} icon={ShoppingBag} tone="neutral" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminSection title="Top services" description="Highest order volume in the selected range" icon={ShoppingBag}>
          {topServices.map((service) => (
            <div key={String(service._id)} className="border-b border-neutral-100 p-4 text-sm">
              <span className="block font-medium">{service.name ?? "Service"}</span>
              <span className="block select-text font-mono text-xs text-neutral-500" data-copy-allowed>
                Provider Service ID: {service.providerServiceId ?? "Unavailable"}
              </span>
              <span className="mt-2 block h-2 rounded-full bg-neutral-100">
                <span className="block h-2 rounded-full bg-teal-700" style={{ width: `${Math.min(100, (service.orders / maxServiceOrders) * 100)}%` }} />
              </span>
              <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                <span>{service.orders} orders</span>
                <span>Revenue: Rs.{service.revenue.toFixed(2)}</span>
                <span>Profit: Rs.{service.profit.toFixed(2)}</span>
              </span>
            </div>
          ))}
          {topServices.length === 0 && <AdminEmptyState icon={ShoppingBag} title={loadError ? "Unable to load services" : "No service data yet"} description={loadError ? "Try again after the analytics service is available." : "Order activity will populate this report."} />}
        </AdminSection>
        <AdminSection title="Top customers" description="Highest revenue customers in the selected range" icon={BadgeIndianRupee}>
          {topCustomers.map((customer) => (
            <div key={String(customer._id)} className="border-b border-neutral-100 p-4 text-sm">
              <span className="block font-medium">{customer.name ?? "Customer"}</span>
              <span className="text-neutral-500">{customer.email}</span>
              <span className="mt-2 block h-2 rounded-full bg-neutral-100">
                <span className="block h-2 rounded-full bg-amber-600" style={{ width: `${Math.min(100, (customer.revenue / maxCustomerRevenue) * 100)}%` }} />
              </span>
              <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                <span>{customer.orders} orders</span>
                <span>Revenue: Rs.{customer.revenue.toFixed(2)}</span>
                <span>Profit: Rs.{customer.profit.toFixed(2)}</span>
              </span>
            </div>
          ))}
          {topCustomers.length === 0 && <AdminEmptyState icon={BadgeIndianRupee} title={loadError ? "Unable to load customers" : "No customer data yet"} description={loadError ? "Try again after the analytics service is available." : "Customer revenue data will appear after orders are placed."} />}
        </AdminSection>
      </div>
    </AppShell>
  );
}
