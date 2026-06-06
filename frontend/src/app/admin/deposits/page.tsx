"use client";

/* eslint-disable @next/next/no-img-element */
import { ActionButton, DepositRejectForm } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiJson, apiUrl } from "@/lib/client-api";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const STATUSES = ["Pending", "Approved", "Rejected"];

type DepositRow = {
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
};

export default function AdminDepositsPage() {
  const searchParams = useSearchParams();
  const requestedStatus = searchParams.get("status") ?? "";
  const status = STATUSES.includes(requestedStatus) ? requestedStatus : "";
  const [allDeposits, setAllDeposits] = useState<DepositRow[]>([]);

  useEffect(() => {
    let mounted = true;
    apiJson("/api/admin/deposits")
      .then((data) => {
        if (!mounted) return;
        setAllDeposits(Array.isArray(data.deposits) ? data.deposits : []);
      })
      .catch((error) => {
        console.error("Unable to load admin deposits", error);
        if (mounted) setAllDeposits([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const deposits = allDeposits.filter((deposit) => !status || deposit.status === status);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deposit verification</h1>
          <p className="mt-1 text-sm text-neutral-600">Manual dashboard and Telegram approvals stay synchronized.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterLink label="All" active={!status} href="/admin/deposits" />
          {STATUSES.map((item) => (
            <FilterLink key={item} label={item} active={status === item} href={`/admin/deposits?status=${item}`} />
          ))}
        </div>
      </div>
      <section className="rounded-md border border-neutral-200 bg-white">
        {deposits.map((deposit) => (
          <div key={String(deposit._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm md:grid-cols-[1fr_120px_150px_120px_160px]">
            <div>
              <p className="font-medium">{deposit.user?.email ?? "User"}</p>
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
        {deposits.length === 0 && <p className="p-4 text-sm text-neutral-500">No deposits submitted.</p>}
      </section>
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
  const resolvedProofUrl = proofUrl.startsWith("/api/") ? apiUrl(proofUrl) : proofUrl;
  const isImage = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(resolvedProofUrl);

  return (
    <div className="mt-2 grid gap-2">
      {isImage ? (
        <a href={resolvedProofUrl} target="_blank" rel="noreferrer" className="block w-fit">
          <img
            src={resolvedProofUrl}
            alt="Payment proof"
            className="h-28 w-28 rounded-md border border-neutral-200 bg-neutral-50 object-cover"
          />
        </a>
      ) : (
        <a
          href={resolvedProofUrl}
          className="inline-flex w-fit rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
          target="_blank"
          rel="noreferrer"
        >
          Open PDF proof
        </a>
      )}
      <a href={resolvedProofUrl} className="text-xs font-medium text-teal-700 hover:underline" target="_blank" rel="noreferrer">
        Open payment proof
      </a>
    </div>
  );
}
