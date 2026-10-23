import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { serverApiJson } from "@/lib/server-api";
import { RefreshCcw } from "lucide-react";

export default async function RefillsPage() {
  let refills: Array<{
    _id: string;
    providerRefillId?: string;
    status: string;
    createdAt: string;
    order?: { providerOrderId?: string; link?: string; status?: string };
  }> = [];

  try {
    const result = await serverApiJson("/api/refills");
    refills = Array.isArray(result.refills) ? result.refills : [];
  } catch {
    refills = [];
  }

  return (
    <AppShell>
      <section className="refills-command mb-6 grid gap-5 overflow-hidden rounded-[1.7rem] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800">
            <RefreshCcw className="size-3.5" /> Delivery care
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-950">Refill requests</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            Track refill requests for eligible completed orders. Status updates appear when the provider returns a refill ID.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-100">Requests</p>
          <p className="mt-1 text-2xl font-extrabold">{refills.length}</p>
          <p className="text-[11px] text-slate-300">in your refill history</p>
        </div>
      </section>
      <section className="refills-list overflow-hidden rounded-[1.5rem] border border-neutral-200 bg-white shadow-sm">
        <div className="hidden border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-500 md:grid md:grid-cols-[minmax(0,1fr)_140px_140px_170px]">
          <span>Order</span>
          <span>Status</span>
          <span>Refill ID</span>
          <span>Requested</span>
        </div>
        <div className="divide-y divide-neutral-100">
          {refills.map((refill) => (
            <div key={String(refill._id)} className="grid gap-3 p-4 text-sm md:grid-cols-[minmax(0,1fr)_140px_140px_170px] md:items-center">
              <div className="min-w-0">
                <p className="font-medium">Order {refill.order?.providerOrderId ?? "-"}</p>
                <p className="truncate text-neutral-500">{refill.order?.link ?? "Link unavailable"}</p>
              </div>
              <StatusBadge status={refill.status} />
              <span className="font-medium text-neutral-700">{refill.providerRefillId ?? "Queued"}</span>
              <span className="text-neutral-500">{new Date(refill.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {refills.length === 0 && (
            <div className="grid place-items-center px-4 py-12 text-center">
              <RefreshCcw className="size-10 text-neutral-300" />
              <p className="mt-3 text-sm font-semibold text-neutral-800">No refill requests yet</p>
              <p className="mt-1 max-w-md text-sm text-neutral-500">The refill action appears on completed eligible orders.</p>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
