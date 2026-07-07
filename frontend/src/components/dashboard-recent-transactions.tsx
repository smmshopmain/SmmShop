"use client";

import { useEffect, useState } from "react";
import { WalletCards } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { apiJson } from "@/lib/client-api";

type Transaction = {
  _id: string;
  type: string;
  amount: number;
  createdAt: string;
};

export function DashboardRecentTransactions({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [transactions, setTransactions] = useState(initialTransactions);

  useEffect(() => {
    let active = true;

    async function refreshTransactions() {
      try {
        const result = await apiJson("/api/wallet", { cache: "no-store" });
        const nextTransactions = Array.isArray(result.transactions)
          ? result.transactions
          : Array.isArray(result.data?.transactions)
          ? result.data.transactions
          : [];
        if (active) setTransactions(nextTransactions.slice(0, 5));
      } catch {
        // Keep the server-rendered transactions if the live refresh fails.
      }
    }

    refreshTransactions();
    const intervalId = window.setInterval(refreshTransactions, 15000);
    window.addEventListener("focus", refreshTransactions);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshTransactions);
    };
  }, []);

  return (
    <>
      {transactions.map((tx) => (
        <div key={String(tx._id)} className="grid gap-3 p-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
          <div className="min-w-0">
            <p className="truncate font-medium capitalize">{tx.type.replaceAll("_", " ")}</p>
            <p className="text-neutral-500">{new Date(tx.createdAt).toLocaleString()}</p>
          </div>
          <StatusBadge status={tx.amount >= 0 ? "Approved" : "Canceled"} />
          <p className="font-semibold">Rs.{tx.amount}</p>
        </div>
      ))}
      {transactions.length === 0 && (
        <div className="grid place-items-center px-4 py-10 text-center">
          <WalletCards className="size-9 text-neutral-300" />
          <p className="mt-3 text-sm font-semibold text-neutral-700">No transactions yet</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-500">Latest wallet activity will appear here after you add funds.</p>
        </div>
      )}
    </>
  );
}
