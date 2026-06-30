/* eslint-disable @next/next/no-img-element */
import { ActionButton, DepositRejectForm } from "@/components/admin-controls";
import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireAdmin } from "@/lib/auth";
import { Deposit } from "@/models";
import { ArrowDownToLine } from "lucide-react";

const STATUSES = ["Pending", "Approved", "Rejected"];

export default async function AdminDepositsPage({ searchParams }: { searchParams?: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const status = params?.status && STATUSES.includes(params.status) ? params.status : "";
  let deposits: Array<{
    _id: string;
    depositId?: string;
    amount: number;
    utr: string;
    status: string;
    proofUrl?: string;
    adminAction?: string;
    adminTelegramId?: string;
    rejectionReason?: string;
    verificationStartTime: string;
    verificationEndTime: string;
    user?: { name?: string; email?: string };
  }> = [];

  try {
    await requireAdmin();
    deposits = (await Deposit.find(status ? { status } : {})
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()) as typeof deposits;
  } catch {
    deposits = [];
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Wallet operations"
        title="Deposit verification"
        description="Review payment proof, UTR, verification windows, and Telegram/dashboard approval state."
        actions={
        <div className="flex flex-wrap gap-2">
          <FilterLink label="All" active={!status} href="/admin/deposits" />
          {STATUSES.map((item) => (
            <FilterLink key={item} label={item} active={status === item} href={`/admin/deposits?status=${item}`} />
          ))}
        </div>
        }
      />
      <AdminSection title="Deposit requests" description="Pending and reviewed wallet top-ups" icon={ArrowDownToLine}>
        <div className="hidden border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-500 md:grid md:grid-cols-[minmax(0,1fr)_120px_150px_120px_160px]">
          <span>User / UTR</span>
          <span>Amount</span>
          <span>Window</span>
          <span>Status</span>
          <span>Review</span>
        </div>
        {deposits.map((deposit) => (
          <div key={String(deposit._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm md:grid-cols-[1fr_120px_150px_120px_160px]">
            <div className="min-w-0">
              <p className="font-semibold text-neutral-950">{deposit.user?.email ?? "User"}</p>
              <p className="text-neutral-900">{deposit.depositId ?? String(deposit._id)}</p>
              <p className="text-neutral-500">UTR {deposit.utr}</p>
              {deposit.adminAction && <p className="text-neutral-500">Action: {deposit.adminAction.replaceAll("_", " ")}</p>}
              {deposit.adminTelegramId && <p className="text-neutral-500">Telegram admin: {deposit.adminTelegramId}</p>}
              {deposit.rejectionReason && <p className="text-rose-700">Reason: {deposit.rejectionReason}</p>}
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
        {deposits.length === 0 && <AdminEmptyState icon={ArrowDownToLine} title="No deposits submitted" description="New add-fund requests will appear here for review." />}
      </AdminSection>
    </AppShell>
  );
}

function FilterLink({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <a
      href={href}
      className={`rounded-md border px-3 py-2 text-sm font-medium ${
        active
          ? "border-teal-700 bg-teal-50 text-teal-800"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-teal-300"
      }`}
    >
      {label}
    </a>
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
