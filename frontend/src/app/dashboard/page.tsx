import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, ArrowUpRight, Clock3, Headphones, PlusCircle, ShoppingBag, Sparkles, WalletCards } from "lucide-react";
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
  { href: "/dashboard/services", title: "Find your next service", text: "Explore options and get started in just a few clicks.", icon: ShoppingBag },
  { href: "/dashboard/orders", title: "Follow your progress", text: "See the latest updates on all your orders.", icon: Clock3 },
  { href: "/dashboard/tickets", title: "We’re here to help", text: "Our support team is ready when you need us.", icon: Headphones },
];

export default async function DashboardPage() {
  return (
    <AppShell>
      <section className="dashboard-command mb-6 grid gap-5 rounded-[1.8rem] border border-teal-900/10 bg-white p-5 shadow-sm sm:p-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800">
            <span className="size-2 rounded-full bg-emerald-500" /> Your workspace
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-950 sm:text-4xl">Good to see you. What’s next?</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
            Your campaigns, wallet and support are all in one place. Pick up where you left off or start something new.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/dashboard/services"
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-teal-800"
            >
              <PlusCircle className="size-4" /> Start an order
            </Link>
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-700 transition hover:border-teal-200 hover:text-teal-800"
            >
              View order activity <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
        <div className="dashboard-launch-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#102a35] via-[#124e4a] to-[#0e7490] p-5 text-white">
          <span className="pointer-events-none absolute -right-7 -top-9 size-36 rounded-full border border-white/15 shadow-[0_0_0_22px_rgba(255,255,255,0.035),0_0_0_44px_rgba(255,255,255,0.025)]" />
          <div className="relative flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-teal-100"><Sparkles className="size-5" /></span>
            <ArrowUpRight className="size-4 text-teal-100" />
          </div>
          <p className="relative mt-5 text-sm font-bold">Ready when you are</p>
          <p className="relative mt-1 text-xs leading-5 text-teal-50/80">Browse the catalog and create an order in a few simple steps.</p>
          <Link href="/dashboard/services" className="relative mt-4 inline-flex text-xs font-bold text-white underline decoration-white/40 underline-offset-4">
            Explore services
          </Link>
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

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="surface-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Wallet activity</p>
              <h2 className="mt-1 text-base font-bold text-neutral-950">Recent transactions</h2>
            </div>
            <Link href="/dashboard/wallet" className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800">
              View wallet <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-neutral-100">
            <DashboardRecentTransactions initialTransactions={[]} />
          </div>
        </section>

        <section className="surface-card p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-800">Quick launch</p>
            <h2 className="mt-1 text-base font-bold text-neutral-950">Where to next?</h2>
          </div>
          <div className="mt-4 grid gap-2.5">
            {quickActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="workspace-link group flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white/70 p-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700 transition group-hover:bg-teal-50 group-hover:text-teal-800">
                  <item.icon className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-neutral-950">{item.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-neutral-500">{item.text}</span>
                </span>
                <ArrowUpRight className="ml-auto size-4 shrink-0 text-neutral-300 transition group-hover:text-teal-700" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
