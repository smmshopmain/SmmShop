import { AppShell } from "@/components/app-shell";
import { ActionButton } from "@/components/admin-controls";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { Order } from "@/models";

export default async function OrdersPage() {
  let orders: Array<{
    _id: string;
    link: string;
    quantity: number;
    status: string;
    sellingPrice: number;
    createdAt: Date;
    service?: { name?: string; refill?: boolean };
  }> = [];

  try {
    const { auth } = await requireUser();
    orders = (await Order.find({ user: auth.id })
      .populate("service", "name refill")
      .sort({ createdAt: -1 })
      .lean()) as typeof orders;
  } catch {
    orders = [];
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">Order history</h1>
      <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        <div className="divide-y divide-neutral-100">
          {orders.map((order) => (
            <div key={String(order._id)} className="grid gap-3 p-4 text-sm md:grid-cols-[1fr_100px_110px_100px_120px]">
              <div>
                <p className="font-medium">{order.service?.name ?? "Service"}</p>
                <p className="truncate text-neutral-500">{order.link}</p>
              </div>
              <p>{order.quantity}</p>
              <StatusBadge status={order.status} />
              <p className="font-semibold">Rs.{order.sellingPrice}</p>
              {order.service?.refill && order.status === "Completed" ? (
                <ActionButton label="Refill" endpoint="/api/refills" method="POST" body={{ orderId: String(order._id) }} />
              ) : (
                <span className="text-xs text-neutral-400">No refill</span>
              )}
            </div>
          ))}
          {orders.length === 0 && <p className="p-6 text-sm text-neutral-500">No orders yet.</p>}
        </div>
      </section>
    </AppShell>
  );
}
