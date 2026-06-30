import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { Refill } from "@/models";
import { RefreshCcw } from "lucide-react";

export default async function RefillsPage() {
  let refills: Array<{
    _id: string;
    providerRefillId?: string;
    status: string;
    createdAt: Date;
    order?: { providerOrderId?: string; link?: string; status?: string };
  }> = [];

  try {
    const { auth } = await requireUser();
    refills = (await Refill.find({ user: auth.id })
      .populate("order", "providerOrderId link status")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()) as typeof refills;
  } catch {
    refills = [];
  }

  return (
    <AppShell>
      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Refill tracking</p>
        <h1 className="mt-2 text-2xl font-bold text-neutral-950 sm:text-3xl">Refills</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
          Eligible completed orders ke refill requests yahan track karein. Provider refill ID milte hi status update dikhega.
        </p>
      </div>
      <section className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
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
              <p className="mt-1 max-w-md text-sm text-neutral-500">Completed eligible orders par refill action available hoga.</p>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
