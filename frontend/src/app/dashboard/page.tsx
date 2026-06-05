"use client";

import { CheckCircle2, Clock3, ShoppingBag, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { apiJson } from "@/lib/client-api";

export default function DashboardPage() {
  const [data, setData] = useState<{
    balance?: number;
    totalOrders?: number;
    activeOrders?: number;
    completedOrders?: number;
    transactions?: Array<{ _id: string; type: string; amount: number; createdAt: string }>;
  } | null>(null);
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [walletRes, ordersRes] = await Promise.allSettled([
          apiJson("/api/wallet"),
          apiJson("/api/orders"),
        ]);

        const out: any = {};

        if (walletRes.status === "fulfilled" && walletRes.value) {
          // backend may return { ok: true, data: { balance, transactions } } or { ok: true, balance }
          const w = walletRes.value;
          out.balance = w?.data?.balance ?? w?.balance ?? w?.walletBalance ?? 0;
          out.transactions = w?.data?.transactions ?? w?.transactions ?? w?.recent ?? [];
        }

        if (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value)) {
          const list = ordersRes.value;
          out.totalOrders = list.length;
          out.activeOrders = list.filter((o: any) => ["Pending", "Processing", "In Progress"].includes(o.status)).length;
          out.completedOrders = list.filter((o: any) => o.status === "Completed").length;
        } else if (ordersRes.status === "fulfilled" && ordersRes.value?.data && Array.isArray(ordersRes.value.data)) {
          const list = ordersRes.value.data;
          out.totalOrders = list.length;
          out.activeOrders = list.filter((o: any) => ["Pending", "Processing", "In Progress"].includes(o.status)).length;
          out.completedOrders = list.filter((o: any) => o.status === "Completed").length;
        }

        if (mounted) setData(out);
      } catch (err: any) {
        if (mounted) setSetupError(err?.message ?? "Dashboard unavailable");
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600">Wallet, order activity, and recent transactions.</p>
      </div>
      {setupError && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Configure backend and environment variables. Current status: {setupError}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Wallet Balance" value={`Rs.${data?.balance ?? 0}`} icon={WalletCards} />
        <StatCard label="Total Orders" value={data?.totalOrders ?? 0} icon={ShoppingBag} tone="neutral" />
        <StatCard label="Active Orders" value={data?.activeOrders ?? 0} icon={Clock3} tone="amber" />
        <StatCard label="Completed Orders" value={data?.completedOrders ?? 0} icon={CheckCircle2} tone="teal" />
      </div>
      <section className="mt-6 rounded-md border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 p-4">
          <h2 className="font-semibold">Recent transactions</h2>
        </div>
        <div className="divide-y divide-neutral-100">
          {(data?.transactions ?? []).map((tx) => (
            <div key={String(tx._id)} className="flex items-center justify-between gap-4 p-4 text-sm">
              <div>
                <p className="font-medium">{(tx.type || "").replaceAll("_", " ")}</p>
                <p className="text-neutral-500">{new Date(tx.createdAt).toLocaleString()}</p>
              </div>
              <StatusBadge status={tx.amount >= 0 ? "Approved" : "Canceled"} />
              <p className="font-semibold">Rs.{tx.amount}</p>
            </div>
          ))}
          {!data?.transactions?.length && <p className="p-4 text-sm text-neutral-500">No transactions yet.</p>}
        </div>
      </section>
    </AppShell>
  );
}
