import { DepositForm } from "@/components/deposit-form";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { Deposit, getSettings, WalletTransaction, type PlatformSettings } from "@/models";
import { ArrowDownToLine, History, WalletCards } from "lucide-react";

export default async function WalletPage() {
  let balance = 0;
  let transactions: Array<{ _id: string; type: string; amount: number; createdAt: Date }> = [];
  let deposits: Array<{ _id: string; depositId?: string; amount: number; utr: string; status: string; createdAt: Date }> = [];
  let payment: PlatformSettings["deposits"]["payment"] = {
    qrImageUrl: "",
    upiId: "",
    accountNumber: "",
    ifsc: "",
    accountName: "",
    bankName: "",
    instructions: "",
  };

  try {
    const { auth, dbUser } = await requireUser();
    balance = dbUser.walletBalance;
    const [nextTransactions, nextDeposits, settings] = await Promise.all([
      WalletTransaction.find({ user: auth.id }).sort({ createdAt: -1 }).limit(20).lean(),
      Deposit.find({ user: auth.id }).sort({ createdAt: -1 }).limit(20).lean(),
      getSettings(),
    ]);
    transactions = nextTransactions as typeof transactions;
    deposits = nextDeposits as typeof deposits;
    payment = settings.deposits.payment;
  } catch {
    transactions = [];
  }

  return (
    <AppShell>
      <div className="mb-6 rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Wallet center</p>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950 sm:text-3xl">Wallet</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
              Add funds, deposit status aur wallet transactions ko ek professional view me manage karein.
            </p>
          </div>
          <div className="rounded-md bg-neutral-950 p-4 text-white">
            <p className="text-sm text-neutral-300">Available balance</p>
            <p className="mt-2 text-3xl font-bold">Rs.{balance}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <DepositForm payment={payment} />
        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-neutral-200 p-4">
            <span className="grid size-10 place-items-center rounded-md bg-teal-50 text-teal-800">
              <ArrowDownToLine className="size-5" />
            </span>
            <div>
              <h2 className="font-bold text-neutral-950">Deposit requests</h2>
              <p className="text-sm text-neutral-500">Latest submitted fund requests</p>
            </div>
          </div>
          <div className="divide-y divide-neutral-100">
            {deposits.map((deposit) => (
              <div key={String(deposit._id)} className="grid gap-3 p-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <span className="min-w-0">
                  <span className="block font-medium">{deposit.depositId ?? String(deposit._id)}</span>
                  <span className="block text-neutral-500">UTR {deposit.utr}</span>
                  <span className="block text-xs text-neutral-400">{new Date(deposit.createdAt).toLocaleString()}</span>
                </span>
                <StatusBadge status={deposit.status} />
                <strong>Rs.{deposit.amount}</strong>
              </div>
            ))}
            {deposits.length === 0 && (
              <div className="grid place-items-center px-4 py-12 text-center">
                <WalletCards className="size-10 text-neutral-300" />
                <p className="mt-3 text-sm font-semibold text-neutral-800">No deposits yet</p>
                <p className="mt-1 max-w-md text-sm text-neutral-500">Add funds form submit karne ke baad deposit request yahan dikhegi.</p>
              </div>
            )}
          </div>
        </section>
      </div>
      <section className="mt-6 rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-neutral-200 p-4">
          <span className="grid size-10 place-items-center rounded-md bg-neutral-100 text-neutral-700">
            <History className="size-5" />
          </span>
          <div>
            <h2 className="font-bold text-neutral-950">Transaction history</h2>
            <p className="text-sm text-neutral-500">Wallet credits, debits and adjustments</p>
          </div>
        </div>
        {transactions.map((tx) => (
          <div key={String(tx._id)} className="grid gap-2 border-b border-neutral-100 p-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <span>
              <span className="block font-medium capitalize">{tx.type.replaceAll("_", " ")}</span>
              <span className="block text-xs text-neutral-500">{new Date(tx.createdAt).toLocaleString()}</span>
            </span>
            <strong className={tx.amount >= 0 ? "text-teal-700" : "text-rose-700"}>Rs.{tx.amount}</strong>
          </div>
        ))}
        {transactions.length === 0 && <p className="p-4 text-sm text-neutral-500">No transactions yet.</p>}
      </section>
    </AppShell>
  );
}
