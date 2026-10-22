import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Clock3, Headphones, PlusCircle, ShoppingBag, Sparkles, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DashboardOrderStats } from "@/components/dashboard-order-stats";
import { DashboardRecentTransactions } from "@/components/dashboard-recent-transactions";
import { StatCard } from "@/components/stat-card";
import { LiveWalletBalance } from "@/components/wallet-balance";

const quickActions: Array<{
  href: Route;
  title: string;
  text: string;
  icon: typeof ShoppingBag;
}> = [
  { href: "/dashboard/services", title: "Browse services", text: "Choose a platform and place a service order.", icon: ShoppingBag },
  { href: "/dashboard/orders", title: "Track orders", text: "Check running and completed orders.", icon: Clock3 },
  { href: "/dashboard/tickets", title: "Need help?", text: "Create a support ticket.", icon: Headphones },
];

export default async function DashboardPage() {
  return (
    <AppShell>
      <section className="workspace-hero mb-6 rounded-3xl p-6 text-white sm:p-8 lg:p-10">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-teal-100">
              <Sparkles className="size-3.5" /> Your workspace
            </p>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">Everything you need, in one place.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-teal-50/85 sm:text-base">
              Keep an eye on your wallet, track orders, and get back to what matters with a clearer, faster dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/services"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-teal-900 shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-teal-50"
            >
              <PlusCircle className="size-4" />
              New order
            </Link>
            <Link
              href="/dashboard/wallet"
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Add funds
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
      <div className="workspace-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Wallet Balance" value={<LiveWalletBalance initialBalance={0} />} icon={WalletCards} />
        <DashboardOrderStats
          initialSummary={{
            totalOrders: 0,
            activeOrders: 0,
            completedOrders: 0,
          }}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="surface-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 p-4">
            <h2 className="font-semibold">Recent transactions</h2>
            <Link href="/dashboard/wallet" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
              View wallet
            </Link>
          </div>
          <div className="divide-y divide-neutral-100">
            <DashboardRecentTransactions initialTransactions={[]} />
          </div>
        </section>

        <section className="surface-card p-5">
          <h2 className="font-semibold">Quick actions</h2>
          <div className="mt-4 grid gap-3">
            {quickActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="workspace-link flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white/70 p-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-neutral-100 text-neutral-700">
                  <item.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-950">{item.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-neutral-600">{item.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
