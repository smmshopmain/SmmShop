import { ActionButton } from "@/components/admin-controls";
import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireAdmin } from "@/lib/auth";
import { Order } from "@/models";
import { Search, ShoppingBag, SlidersHorizontal } from "lucide-react";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function AdminOrdersPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const q = params?.q?.trim() ?? "";
  const status = params?.status?.trim() ?? "";
  let orders: Array<{
    _id: string;
    link: string;
    quantity: number;
    status: string;
    sellingPrice: number;
    providerOrderId?: string;
    user?: { email?: string };
    service?: { name?: string; cancel?: boolean };
    createdAt: Date;
  }> = [];

  try {
    await requireAdmin();
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (q) filter.$or = [{ link: new RegExp(escapeRegExp(q), "i") }, { providerOrderId: new RegExp(escapeRegExp(q), "i") }];
    orders = (await Order.find(filter)
      .populate("user", "email")
      .populate("service", "name cancel")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()) as typeof orders;
  } catch {
    orders = [];
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Order operations"
        title="Orders"
        description="Search, filter, and cancel eligible provider orders from a clean admin queue."
        actions={
        <form className="grid gap-2 sm:grid-cols-[1fr_150px_auto]" action="/admin/orders">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-neutral-400" />
            <input name="q" defaultValue={q} placeholder="Search orders" className="h-11 w-full rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10" />
          </label>
          <select name="status" defaultValue={status} className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10">
            <option value="">All statuses</option>
            {["Pending", "Processing", "In Progress", "Completed", "Partial", "Canceled"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white hover:bg-neutral-800">
            <SlidersHorizontal className="size-4" />
            Filter
          </button>
        </form>
        }
      />
      <AdminSection title="Order queue" description="Latest provider orders and operational actions" icon={ShoppingBag}>
        <div className="hidden border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-500 xl:grid xl:grid-cols-[minmax(0,1fr)_170px_110px_100px_120px]">
          <span>Order</span>
          <span>Created</span>
          <span>Status</span>
          <span>Charge</span>
          <span>Action</span>
        </div>
        {orders.map((order) => (
          <div key={String(order._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm xl:grid-cols-[minmax(0,1fr)_170px_110px_100px_120px] xl:items-center">
            <div className="min-w-0">
              <p className="font-semibold text-neutral-950">{order.service?.name ?? "Service"}</p>
              <p className="text-neutral-500">{order.user?.email ?? "User"} / {order.providerOrderId ?? "-"}</p>
              <p className="truncate text-neutral-500">{order.link}</p>
            </div>
            <span className="text-neutral-500">{new Date(order.createdAt).toLocaleString()}</span>
            <StatusBadge status={order.status} />
            <strong>Rs.{order.sellingPrice}</strong>
            {order.service?.cancel && ["Pending", "Processing", "In Progress"].includes(order.status) ? (
              <ActionButton label="Cancel" endpoint="/api/admin/orders" body={{ id: String(order._id), action: "cancel" }} danger />
            ) : (
              <span className="text-xs text-neutral-400">No action</span>
            )}
          </div>
        ))}
        {orders.length === 0 && <AdminEmptyState icon={ShoppingBag} title="No orders found" description="Try changing the filters or wait for new customer orders." />}
      </AdminSection>
    </AppShell>
  );
}
