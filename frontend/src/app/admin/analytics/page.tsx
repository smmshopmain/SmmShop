import { BadgeIndianRupee, Banknote, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { apiUrl } from "@/lib/client-api";
import { serverApiJson } from "@/lib/server-api";

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
    const data = await serverApiJson(`/api/admin/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    daily = data.daily ?? daily;
    weekly = data.weekly ?? weekly;
    monthly = data.monthly ?? monthly;
    topServices = data.topServices ?? [];
    topCustomers = data.topCustomers ?? [];
  } catch {
    topServices = [];
  }

  const exportUrl = apiUrl(`/api/admin/analytics/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-neutral-600">Revenue, profit, top services, and top customers.</p>
      </div>
      <form className="mb-4 grid gap-2 rounded-md border border-neutral-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto_auto]" action="/admin/analytics">
        <input name="from" type="date" defaultValue={from} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        <input name="to" type="date" defaultValue={to} className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">Apply</button>
        <a
          href={exportUrl}
          className="rounded-md border border-neutral-300 px-4 py-2 text-center text-sm font-semibold hover:bg-neutral-50"
        >
          Export CSV
        </a>
      </form>
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
                <span className="mt-2 block h-2 rounded-md bg-neutral-100">
                  <span className="block h-2 rounded-md bg-amber-600" style={{ width: `${Math.min(100, customer.orders * 10)}%` }} />
                </span>
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
