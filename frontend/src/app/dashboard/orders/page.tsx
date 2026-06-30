import { AppShell } from "@/components/app-shell";
import { OrderLiveList, type LiveOrder } from "@/components/order-live-list";
import { serverApiJson } from "@/lib/server-api";
import { Search, SlidersHorizontal } from "lucide-react";

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
    startCount?: number;
    remains?: number;
    createdAt: string;
    updatedAt: string;
    lastStatusSyncAt?: string;
    providerOrderId?: string;
    providerResponse?: { lastStatus?: { status?: string; start_count?: string | number; remains?: string | number; charge?: string | number } };
    service?: { name?: string; refill?: boolean; cancel?: boolean };
  }> = [];

  try {
    const result = await serverApiJson("/api/orders?sync=1");
    orders = Array.isArray(result.orders) ? result.orders : [];
  } catch {
      orders = [];
  }

  const liveOrders: LiveOrder[] = orders.map((order) => ({
    _id: String(order._id),
    link: order.link,
    quantity: order.quantity,
    status: order.status,
    sellingPrice: order.sellingPrice,
    startCount: order.startCount,
    remains: order.remains,
    createdAt: new Date(order.createdAt).toISOString(),
    updatedAt: new Date(order.updatedAt).toISOString(),
    lastStatusSyncAt: order.lastStatusSyncAt ? new Date(order.lastStatusSyncAt).toISOString() : undefined,
    providerOrderId: order.providerOrderId,
    providerResponse: order.providerResponse,
    service: order.service,
  }));

  return (
    <AppShell>
      <div className="mb-6 overflow-hidden rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Order center</p>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950 sm:text-3xl">Order history</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
              Link, provider order ID, quantity, status aur refill/cancel actions ek clean view me.
            </p>
        </div>
          <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px_auto]" action="/dashboard/orders">
            <label className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-neutral-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search link or order ID"
                className="h-11 w-full rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
              />
            </label>
            <select
              name="status"
              defaultValue={status}
              className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            >
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
        </div>
      </div>
      <OrderLiveList initialOrders={liveOrders} q={q} status={status} />
    </AppShell>
  );
}
