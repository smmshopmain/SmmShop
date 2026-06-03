import { ActionButton } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireAdmin } from "@/lib/auth";
import { Deposit } from "@/models";

export default async function AdminDepositsPage() {
  let deposits: Array<{
    _id: string;
    amount: number;
    utr: string;
    status: string;
    proofUrl?: string;
    verificationStartTime: string;
    verificationEndTime: string;
    user?: { name?: string; email?: string };
  }> = [];

  try {
    await requireAdmin();
    deposits = (await Deposit.find().populate("user", "name email").sort({ createdAt: -1 }).limit(100).lean()) as typeof deposits;
  } catch {
    deposits = [];
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">Deposit verification</h1>
      <section className="rounded-md border border-neutral-200 bg-white">
        {deposits.map((deposit) => (
          <div key={String(deposit._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm md:grid-cols-[1fr_120px_150px_120px_160px]">
            <div>
              <p className="font-medium">{deposit.user?.email ?? "User"}</p>
              <p className="text-neutral-500">UTR {deposit.utr}</p>
              {deposit.proofUrl && (
                <a href={deposit.proofUrl} className="text-teal-700 hover:underline" target="_blank">
                  Proof
                </a>
              )}
            </div>
            <strong>Rs.{deposit.amount}</strong>
            <span>{deposit.verificationStartTime} - {deposit.verificationEndTime}</span>
            <StatusBadge status={deposit.status} />
            {deposit.status === "Pending" && (
              <div className="flex flex-wrap gap-2">
                <ActionButton label="Approve" endpoint="/api/admin/deposits" body={{ id: String(deposit._id), action: "approve" }} />
                <ActionButton label="Reject" endpoint="/api/admin/deposits" body={{ id: String(deposit._id), action: "reject" }} danger />
              </div>
            )}
          </div>
        ))}
        {deposits.length === 0 && <p className="p-4 text-sm text-neutral-500">No deposits submitted.</p>}
      </section>
    </AppShell>
  );
}
