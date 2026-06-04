/* eslint-disable @next/next/no-img-element */
import { ActionButton, DepositRejectForm } from "@/components/admin-controls";
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
              {deposit.proofUrl && <ProofPreview proofUrl={deposit.proofUrl} />}
            </div>
            <strong>Rs.{deposit.amount}</strong>
            <span>{deposit.verificationStartTime} - {deposit.verificationEndTime}</span>
            <StatusBadge status={deposit.status} />
            {deposit.status === "Pending" && (
              <div className="grid gap-2">
                <ActionButton label="Approve" endpoint="/api/admin/deposits" body={{ id: String(deposit._id), action: "approve" }} />
                <DepositRejectForm depositId={String(deposit._id)} />
              </div>
            )}
          </div>
        ))}
        {deposits.length === 0 && <p className="p-4 text-sm text-neutral-500">No deposits submitted.</p>}
      </section>
    </AppShell>
  );
}

function ProofPreview({ proofUrl }: { proofUrl: string }) {
  const isImage = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(proofUrl);

  return (
    <div className="mt-2 grid gap-2">
      {isImage ? (
        <a href={proofUrl} target="_blank" rel="noreferrer" className="block w-fit">
          <img
            src={proofUrl}
            alt="Payment proof"
            className="h-28 w-28 rounded-md border border-neutral-200 bg-neutral-50 object-cover"
          />
        </a>
      ) : (
        <a
          href={proofUrl}
          className="inline-flex w-fit rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
          target="_blank"
          rel="noreferrer"
        >
          Open PDF proof
        </a>
      )}
      <a href={proofUrl} className="text-xs font-medium text-teal-700 hover:underline" target="_blank" rel="noreferrer">
        Open payment proof
      </a>
    </div>
  );
}
