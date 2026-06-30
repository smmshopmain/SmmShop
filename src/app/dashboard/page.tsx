import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, CheckCircle2, Clock3, Headphones, PlusCircle, ShoppingBag, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Order, WalletTransaction } from "@/models";

const quickActions: Array<{
  href: Route;
  title: string;
  text: string;
  icon: typeof ShoppingBag;
}> = [
  { href: "/dashboard/services", title: "Browse services", text: "Platform select karke service order karein.", icon: ShoppingBag },
  { href: "/dashboard/orders", title: "Track orders", text: "Running aur completed orders check karein.", icon: Clock3 },
  { href: "/dashboard/tickets", title: "Need help?", text: "Support ticket create karein.", icon: Headphones },
];

export default async function DashboardPage() {
  let data:
    | {
        balance: number;
        totalOrders: number;
        activeOrders: number;
        completedOrders: number;
        transactions: Array<{ _id: string; type: string; amount: number; createdAt: Date }>;
      }
    | null = null;
  let setupError = "";

  try {
    const { auth, dbUser } = await requireUser();
    await dbConnect();
    const [totalOrders, activeOrders, completedOrders, transactions] = await Promise.all([
      Order.countDocuments({ user: auth.id }),
      Order.countDocuments({ user: auth.id, status: { $in: ["Pending", "Processing", "In Progress"] } }),
      Order.countDocuments({ user: auth.id, status: "Completed" }),
      WalletTransaction.find({ user: auth.id }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);
    data = {
      balance: dbUser.walletBalance,
      totalOrders,
      activeOrders,
      completedOrders,
      transactions: transactions as Array<{ _id: string; type: string; amount: number; createdAt: Date }>,
    };
  } catch (error) {
    setupError = error instanceof Error ? error.message : "Dashboard unavailable";
  }

  return (
    <AppShell>
      <div className="mb-6 overflow-hidden rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Account overview</p>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950 sm:text-3xl">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
              Wallet balance, active orders aur recent activity ek clean view me. New order ke liye services page open karein.
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
      {setupError && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Configure MONGODB_URI and JWT_SECRET in .env.local, then restart the dev server. Current status: {setupError}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Wallet Balance" value={`Rs.${data?.balance ?? 0}`} icon={WalletCards} />
        <StatCard label="Total Orders" value={data?.totalOrders ?? 0} icon={ShoppingBag} tone="neutral" />
        <StatCard label="Active Orders" value={data?.activeOrders ?? 0} icon={Clock3} tone="amber" />
        <StatCard label="Completed Orders" value={data?.completedOrders ?? 0} icon={CheckCircle2} tone="teal" />
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
            {(data?.transactions ?? []).map((tx) => (
              <div key={String(tx._id)} className="grid gap-3 p-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-medium capitalize">{tx.type.replaceAll("_", " ")}</p>
                  <p className="text-neutral-500">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
                <StatusBadge status={tx.amount >= 0 ? "Approved" : "Canceled"} />
                <p className="font-semibold">Rs.{tx.amount}</p>
              </div>
            ))}
            {!data?.transactions.length && (
              <div className="grid place-items-center px-4 py-10 text-center">
                <WalletCards className="size-9 text-neutral-300" />
                <p className="mt-3 text-sm font-semibold text-neutral-700">No transactions yet</p>
                <p className="mt-1 max-w-sm text-sm text-neutral-500">Funds add karne ke baad latest wallet activity yahan dikhegi.</p>
              </div>
            )}
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
