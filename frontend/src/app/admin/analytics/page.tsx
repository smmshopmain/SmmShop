import { AdminHeader } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { apiUrl } from "@/lib/client-api";
import { AdminAnalyticsReport } from "@/components/admin-analytics-report";

export default async function AnalyticsPage({ searchParams }: { searchParams?: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const from = params?.from ?? "";
  const to = params?.to ?? "";

  const exportUrl = apiUrl(`/api/admin/analytics/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
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
            <a href={exportUrl} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-center text-sm font-semibold hover:bg-neutral-50">
              Export CSV
            </a>
          </form>
        }
      />
      <AdminAnalyticsReport from={from} to={to} />
    </AppShell>
  );
}
