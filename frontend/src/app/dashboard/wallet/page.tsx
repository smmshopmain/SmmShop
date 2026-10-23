"use client";

import { useEffect, useState } from "react";
import { DepositForm } from "@/components/deposit-form";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { LiveWalletBalance } from "@/components/wallet-balance";
import { apiJson } from "@/lib/client-api";
import { ArrowDownToLine, ArrowUpRight, History, ShieldCheck, WalletCards } from "lucide-react";

type PaymentDetails = {
  qrImageUrl: string;
  upiId: string;
  accountNumber: string;
  ifsc: string;
  accountName: string;
  bankName: string;
  instructions: string;
};

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Array<{ _id: string; type: string; amount: number; createdAt: string }>>([]);
  const [deposits, setDeposits] = useState<Array<{ _id: string; depositId?: string; amount: number; utr: string; status: string; createdAt: string }>>([]);
  const [payment, setPayment] = useState<PaymentDetails>({
    qrImageUrl: "",
    upiId: "",
    accountNumber: "",
    ifsc: "",
    accountName: "",
    bankName: "",
    instructions: "",
  });
  const [minimumWalletAddAmount, setMinimumWalletAddAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadWalletData() {
      const results = await Promise.allSettled([
        apiJson("/api/wallet", { cache: "no-store" }),
        apiJson("/api/deposits", { cache: "no-store" }),
        apiJson("/api/payment-details", { cache: "no-store" }),
      ]);

      if (!mounted) return;

      let nextLoadError = false;

      const walletResult = results[0];
      if (walletResult.status === "fulfilled" && walletResult.value.ok === true) {
        setBalance(Number(walletResult.value.balance ?? 0));
        setTransactions(Array.isArray(walletResult.value.transactions) ? walletResult.value.transactions.slice(0, 20) : []);
      } else {
        nextLoadError = true;
      }

      const depositResult = results[1];
      if (depositResult.status === "fulfilled" && depositResult.value.ok === true) {
        setDeposits(Array.isArray(depositResult.value.deposits) ? depositResult.value.deposits.slice(0, 20) : []);
      } else {
        nextLoadError = true;
      }

      const paymentResult = results[2];
      if (paymentResult.status === "fulfilled" && paymentResult.value.ok === true) {
        setPayment({
          qrImageUrl: paymentResult.value.payment?.qrImageUrl ?? "",
          upiId: paymentResult.value.payment?.upiId ?? "",
          accountNumber: paymentResult.value.payment?.accountNumber ?? "",
          ifsc: paymentResult.value.payment?.ifsc ?? "",
          accountName: paymentResult.value.payment?.accountName ?? "",
          bankName: paymentResult.value.payment?.bankName ?? "",
          instructions: paymentResult.value.payment?.instructions ?? "",
        });
        setMinimumWalletAddAmount(Number(paymentResult.value.minimumWalletAddAmount ?? 0));
      } else {
        nextLoadError = true;
      }

      setLoadError(nextLoadError);
      setIsLoading(false);
    }

    loadWalletData();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppShell>
      <section className="wallet-command mb-6 overflow-hidden rounded-[1.8rem] bg-slate-950 text-white shadow-xl shadow-slate-900/10">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="wallet-intro p-5 sm:p-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-teal-200/20 bg-teal-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.17em] text-teal-100">
              <WalletCards className="size-3.5" /> Wallet center
            </p>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Your funds, in focus.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Add funds securely, keep tabs on pending deposits, and review every wallet movement.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-teal-100">
              <ShieldCheck className="size-4" /> Deposit requests are reviewed before wallet credit
            </div>
          </div>
          <div className="wallet-balance-card relative flex flex-col justify-between overflow-hidden border-t border-white/10 bg-gradient-to-br from-teal-800 to-cyan-900 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <span className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full border border-white/15 shadow-[0_0_0_22px_rgba(255,255,255,0.035),0_0_0_44px_rgba(255,255,255,0.025)]" />
            <div className="relative flex items-center justify-between text-xs font-semibold text-teal-50/80">
              <span>Available balance</span>
              <ArrowUpRight className="size-4" />
            </div>
            <p className="relative mt-5 text-4xl font-extrabold tracking-tight">
              <LiveWalletBalance initialBalance={balance} />
            </p>
            <p className="relative mt-2 text-xs text-teal-50/70">Ready to use for your next campaign</p>
          </div>
        </div>
      </section>
      {loadError && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Some wallet details could not be loaded right now. Please try again later or contact support.
        </div>
      )}
      <div className="wallet-workspace grid gap-6 xl:grid-cols-[minmax(340px,0.82fr)_minmax(0,1.18fr)]">
        <DepositForm payment={payment} minimumWalletAddAmount={minimumWalletAddAmount} />
        <section className="wallet-deposits rounded-[1.5rem] border border-neutral-200 bg-white shadow-sm">
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
                <p className="mt-1 max-w-md text-sm text-neutral-500">Deposit requests will appear here after you submit the add funds form.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
          <p className="text-center text-sm text-neutral-500">Loading wallet history…</p>
        </div>
      ) : (
        <section className="wallet-history mt-6 rounded-[1.5rem] border border-neutral-200 bg-white shadow-sm">
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
      )}
    </AppShell>
  );
}
