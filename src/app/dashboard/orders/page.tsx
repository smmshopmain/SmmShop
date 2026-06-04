import { AppShell } from "@/components/app-shell";
import { ActionButton } from "@/components/admin-controls";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { Order } from "@/models";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function OrdersPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const q = params?.q?.trim() ?? "";
  const status = params?.status?.trim() ?? "";
  let orders: Array<{
    _id: string;
    link: string;
    quantity: number;
    status: string;
    sellingPrice: number;
    createdAt: Date;
    providerOrderId?: string;
    service?: { name?: string; refill?: boolean; cancel?: boolean };
  }> = [];

  try {
    const { auth } = await requireUser();
    const filter: Record<string, unknown> = { user: auth.id };
    if (status) filter.status = status;
    if (q) filter.$or = [{ link: new RegExp(escapeRegExp(q), "i") }, { providerOrderId: new RegExp(escapeRegExp(q), "i") }];
    orders = (await Order.find(filter)
      .populate("service", "name refill cancel")
      .sort({ createdAt: -1 })
      .lean()) as typeof orders;
  } catch {
    orders = [];
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Order history</h1>
          <p className="mt-1 text-sm text-neutral-600">Search by link/order id and filter by status.</p>
        </div>
        <form className="grid gap-2 sm:grid-cols-[1fr_150px_auto]" action="/dashboard/orders">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search orders"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <select name="status" defaultValue={status} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {["Pending", "Processing", "In Progress", "Completed", "Partial", "Canceled"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">Filter</button>
        </form>
      </div>
      <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        <div className="divide-y divide-neutral-100">
          {orders.map((order) => (
            <div key={String(order._id)} className="grid gap-3 p-4 text-sm md:grid-cols-[1fr_90px_110px_90px_190px]">
              <div>
                <p className="font-medium">{order.service?.name ?? "Service"}</p>
                <p className="truncate text-neutral-500">{order.link}</p>
              </div>
              <p>{order.quantity}</p>
              <StatusBadge status={order.status} />
              <p className="font-semibold">Rs.{order.sellingPrice}</p>
              <div className="flex flex-wrap gap-2">
                {order.service?.refill && order.status === "Completed" && (
                  <ActionButton label="Refill" endpoint="/api/refills" method="POST" body={{ orderId: String(order._id) }} />
                )}
                {order.service?.cancel && ["Pending", "Processing", "In Progress"].includes(order.status) && (
                  <ActionButton label="Cancel" endpoint="/api/orders" body={{ id: String(order._id), action: "cancel" }} danger />
                )}
                {!order.service?.refill && !order.service?.cancel && <span className="text-xs text-neutral-400">No actions</span>}
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="p-6 text-sm text-neutral-500">No orders yet.</p>}
        </div>
      </section>
    </AppShell>
  );
}
