"use client";

import Link from "next/link";
import { Activity, ArrowRight, BadgeIndianRupee, Banknote, Palette, Settings2, ShoppingBag, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { ActionButton } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { apiJson } from "@/lib/client-api";

export default function AdminPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalOrders: 0,
    todaysOrders: 0,
    revenue: 0,
    profit: 0,
    deposits: 0,
    pendingDeposits: 0,
    providerBalance: 0,
  });

  useEffect(() => {
    let mounted = true;
    apiJson("/api/admin/dashboard")
      .then((res) => {
        if (!mounted) return;
        // backend likely returns { ok: true, data: { ...stats } }
        const payload = res?.data ?? res ?? {};
        setStats((s) => ({ ...s, ...payload }));
      })
      .catch(() => {})
      .finally(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppShell>
      <section className="workspace-hero mb-6 rounded-3xl p-6 text-white sm:p-8 lg:p-9">
        <div className="relative z-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-teal-100">
              <Activity className="size-3.5" /> Operations overview
            </p>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Admin command center</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-teal-50/85 sm:text-base">
              Monitor platform activity, keep services in sync, and manage the experience your customers see.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/admin/settings#payment-details" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-teal-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-50">
                <Settings2 className="size-4" /> Platform settings
              </Link>
              <Link href="/admin/settings#animation-settings" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20">
                <Palette className="size-4" /> Website design
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 xl:max-w-[25rem] xl:justify-end">
            <ActionButton label="Sync orders" endpoint="/api/cron/status-sync" method="GET" />
            <ActionButton label="Sync refills" endpoint="/api/cron/refill-sync" method="GET" />
            <ActionButton label="Sync balances" endpoint="/api/cron/provider-balance" method="GET" />
          </div>
        </div>
      </section>
      <div className="workspace-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Users" value={stats.totalUsers} icon={Users} />
        <StatCard label="Active Users" value={stats.activeUsers} icon={Users} tone="neutral" />
        <StatCard label="Total Orders" value={stats.totalOrders} icon={ShoppingBag} tone="amber" />
        <StatCard label="Today's Orders" value={stats.todaysOrders} icon={ShoppingBag} />
        <StatCard label="Revenue" value={`Rs.${stats.revenue}`} icon={Banknote} />
        <StatCard label="Profit" value={`Rs.${stats.profit}`} icon={BadgeIndianRupee} tone="amber" />
        <StatCard label="Deposits" value={stats.deposits} icon={Banknote} tone="neutral" />
        <StatCard label="Pending Deposits" value={stats.pendingDeposits} icon={Banknote} tone="rose" />
        <StatCard label="Provider Balance" value={`Rs.${stats.providerBalance}`} icon={Banknote} />
      </div>
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Link href="/admin/orders" className="workspace-link surface-card flex items-center gap-4 p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-800"><ShoppingBag className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-neutral-950">Order operations</span>
            <span className="mt-1 block text-sm text-neutral-600">Review and manage customer orders.</span>
          </span>
          <ArrowRight className="size-4 text-neutral-400" />
        </Link>
        <Link href="/admin/users" className="workspace-link surface-card flex items-center gap-4 p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-700"><Users className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-neutral-950">Customer accounts</span>
            <span className="mt-1 block text-sm text-neutral-600">Find users and manage account access.</span>
          </span>
          <ArrowRight className="size-4 text-neutral-400" />
        </Link>
        <Link href="/admin/settings#animation-settings" className="workspace-link surface-card flex items-center gap-4 p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700"><Sparkles className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-neutral-950">Animations & appearance</span>
            <span className="mt-1 block text-sm text-neutral-600">Choose from 20 themed loaders, set random or specific mode, and manage site motion.</span>
          </span>
          <ArrowRight className="size-4 text-neutral-400" />
        </Link>
      </section>
    </AppShell>
  );
}
