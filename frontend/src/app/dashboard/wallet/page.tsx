"use client";

import { useEffect, useState } from "react";
import { DepositForm } from "@/components/deposit-form";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { LiveWalletBalance } from "@/components/wallet-balance";
import { apiJson } from "@/lib/client-api";
import { ArrowDownToLine, History, WalletCards } from "lucide-react";

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
      <div className="mb-6 rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Wallet center</p>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950 sm:text-3xl">Wallet</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
              Manage funds, deposit status, and wallet transactions in a clean workspace.
            </p>
          </div>
          <div className="rounded-md bg-neutral-950 p-4 text-white">
            <p className="text-sm text-neutral-300">Available balance</p>
            <p className="mt-2 text-3xl font-bold">
              <LiveWalletBalance initialBalance={balance} />
            </p>
          </div>
        </div>
      </div>
      {loadError && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Some wallet details could not be loaded right now. Please try again later or contact support.
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <DepositForm payment={payment} minimumWalletAddAmount={minimumWalletAddAmount} />
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
      )}
    </AppShell>
  );
}
