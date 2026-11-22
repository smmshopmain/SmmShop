"use client";

import { useEffect, useState } from "react";
import { BadgeIndianRupee, Banknote, ShoppingBag } from "lucide-react";
import { AdminEmptyState, AdminSection } from "@/components/admin-ui";
import { StatCard } from "@/components/stat-card";
import { apiJson } from "@/lib/client-api";

type AnalyticsReport = {
  summary: { orders: number; revenue: number; profit: number };
  topServices: Array<{ _id: string; name?: string; orders: number; revenue: number; profit: number }>;
  topCustomers: Array<{ _id: string; name?: string; email?: string; orders: number; revenue: number; profit: number }>;
};

const EMPTY_REPORT: AnalyticsReport = {
  summary: { orders: 0, revenue: 0, profit: 0 },
  topServices: [],
  topCustomers: [],
};

export function AdminAnalyticsReport({ from, to }: { from: string; to: string }) {
  const [report, setReport] = useState(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadReport() {
      setLoading(true);
      setLoadError("");
      setReport(EMPTY_REPORT);
      const params = new URLSearchParams({ from, to });

      try {
        const data = await apiJson(`/api/admin/analytics?${params.toString()}`, { cache: "no-store" });
        if (!data?.ok) throw new Error(data?.message || "Analytics could not be loaded.");
        if (!active) return;
        setReport({
          summary: data.summary ?? EMPTY_REPORT.summary,
          topServices: Array.isArray(data.topServices) ? data.topServices : [],
          topCustomers: Array.isArray(data.topCustomers) ? data.topCustomers : [],
        });
      } catch (error) {
        console.error("Unable to load admin analytics.", error);
        if (active) {
          setLoadError(error instanceof Error
            ? error.message
            : "Analytics could not be loaded. Check your connection and try again.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadReport();
    return () => {
      active = false;
    };
  }, [from, to]);

  const { summary, topServices, topCustomers } = report;
  const maxServiceOrders = Math.max(1, ...topServices.map((service) => service.orders));
  const maxCustomerRevenue = Math.max(1, ...topCustomers.map((customer) => customer.revenue));

  return (
    <>
      {loading && <p role="status" className="mb-4 text-sm text-neutral-600">Loading analytics...</p>}
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
                Service ID: {service._id}
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
          {!loading && topServices.length === 0 && <AdminEmptyState icon={ShoppingBag} title={loadError ? "Unable to load services" : "No service data yet"} description={loadError ? "Try again after the analytics service is available." : "Order activity will populate this report."} />}
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
          {!loading && topCustomers.length === 0 && <AdminEmptyState icon={BadgeIndianRupee} title={loadError ? "Unable to load customers" : "No customer data yet"} description={loadError ? "Try again after the analytics service is available." : "Customer revenue data will appear after orders are placed."} />}
        </AdminSection>
      </div>
    </>
  );
}
