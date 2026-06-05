import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { Refill } from "@/models";

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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Refills</h1>
        <p className="mt-1 text-sm text-neutral-600">Track refill requests for eligible completed orders.</p>
      </div>
      <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        <div className="divide-y divide-neutral-100">
          {refills.map((refill) => (
            <div key={String(refill._id)} className="grid gap-3 p-4 text-sm md:grid-cols-[1fr_140px_120px_150px]">
              <div>
                <p className="font-medium">Order {refill.order?.providerOrderId ?? "-"}</p>
                <p className="truncate text-neutral-500">{refill.order?.link ?? "Link unavailable"}</p>
              </div>
              <StatusBadge status={refill.status} />
              <span>{refill.providerRefillId ?? "Queued"}</span>
              <span className="text-neutral-500">{new Date(refill.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {refills.length === 0 && <p className="p-6 text-sm text-neutral-500">No refill requests yet.</p>}
        </div>
      </section>
    </AppShell>
  );
}
