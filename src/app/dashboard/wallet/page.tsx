import { DepositForm } from "@/components/deposit-form";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { Deposit, getSettings, WalletTransaction, type PlatformSettings } from "@/models";

export default async function WalletPage() {
  let balance = 0;
  let transactions: Array<{ _id: string; type: string; amount: number; createdAt: Date }> = [];
  let deposits: Array<{ _id: string; amount: number; utr: string; status: string; createdAt: Date }> = [];
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Wallet</h1>
        <p className="mt-1 text-sm text-neutral-600">Balance: Rs.{balance}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <DepositForm payment={payment} />
        <section className="rounded-md border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 p-4">
            <h2 className="font-semibold">Deposit requests</h2>
          </div>
          <div className="divide-y divide-neutral-100">
            {deposits.map((deposit) => (
              <div key={String(deposit._id)} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span>UTR {deposit.utr}</span>
                <StatusBadge status={deposit.status} />
                <strong>Rs.{deposit.amount}</strong>
              </div>
            ))}
            {deposits.length === 0 && <p className="p-4 text-sm text-neutral-500">No deposits yet.</p>}
          </div>
        </section>
      </div>
      <section className="mt-6 rounded-md border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 p-4">
          <h2 className="font-semibold">Transaction history</h2>
        </div>
        {transactions.map((tx) => (
          <div key={String(tx._id)} className="flex items-center justify-between border-b border-neutral-100 p-4 text-sm">
            <span>{tx.type.replaceAll("_", " ")}</span>
            <strong>Rs.{tx.amount}</strong>
          </div>
        ))}
        {transactions.length === 0 && <p className="p-4 text-sm text-neutral-500">No transactions yet.</p>}
      </section>
    </AppShell>
  );
}
