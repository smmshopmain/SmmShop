import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Clock3, Headphones, PlusCircle, ShoppingBag, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DashboardOrderStats } from "@/components/dashboard-order-stats";
import { DashboardRecentTransactions } from "@/components/dashboard-recent-transactions";
import { StatCard } from "@/components/stat-card";
import { LiveWalletBalance } from "@/components/wallet-balance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      <div className="mb-6 overflow-hidden rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Account overview</p>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950 sm:text-3xl">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
              View wallet balance, active orders, and recent activity in one clean workspace. Open the services page to place a new order.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/services"
              className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
            >
              <PlusCircle className="size-4" />
              New order
            </Link>
            <Link
              href="/dashboard/wallet"
              className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-neutral-100"
            >
              Add funds
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        <section className="rounded-md border border-neutral-200 bg-white shadow-sm">
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

        <section className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Quick actions</h2>
          <div className="mt-4 grid gap-3">
            {quickActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-start gap-3 rounded-md border border-neutral-200 p-3 transition hover:border-teal-200 hover:bg-teal-50"
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
