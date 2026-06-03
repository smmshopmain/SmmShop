import { CheckCircle2, Clock3, ShoppingBag, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Order, WalletTransaction } from "@/models";

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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600">Wallet, order activity, and recent transactions.</p>
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
      <section className="mt-6 rounded-md border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 p-4">
          <h2 className="font-semibold">Recent transactions</h2>
        </div>
        <div className="divide-y divide-neutral-100">
          {(data?.transactions ?? []).map((tx) => (
            <div key={String(tx._id)} className="flex items-center justify-between gap-4 p-4 text-sm">
              <div>
                <p className="font-medium">{tx.type.replaceAll("_", " ")}</p>
                <p className="text-neutral-500">{new Date(tx.createdAt).toLocaleString()}</p>
              </div>
              <StatusBadge status={tx.amount >= 0 ? "Approved" : "Canceled"} />
              <p className="font-semibold">Rs.{tx.amount}</p>
            </div>
          ))}
          {!data?.transactions.length && <p className="p-4 text-sm text-neutral-500">No transactions yet.</p>}
        </div>
      </section>
    </AppShell>
  );
}
