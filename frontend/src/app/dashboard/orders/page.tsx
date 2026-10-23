import { AppShell } from "@/components/app-shell";
import { OrderLiveList, type LiveOrder } from "@/components/order-live-list";
import { serverApiJson } from "@/lib/server-api";
import { ArrowUpRight, Search, SlidersHorizontal, Sparkles } from "lucide-react";

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
    providerResponse: order.providerResponse
      ? {
          lastStatus: order.providerResponse.lastStatus
            ? {
                status: order.providerResponse.lastStatus.status ?? undefined,
                start_count: order.providerResponse.lastStatus.start_count,
                remains: order.providerResponse.lastStatus.remains,
                charge: order.providerResponse.lastStatus.charge,
              }
            : undefined,
        }
      : undefined,
    service: order.service
      ? {
          name: order.service.name,
          refill: Boolean(order.service.refill),
          cancel: Boolean(order.service.cancel),
        }
      : undefined,
  }));

  return (
    <AppShell>
      <section className="orders-command mb-6 overflow-hidden rounded-[1.7rem] border border-neutral-200 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(450px,1.15fr)]">
          <div className="orders-intro p-5 sm:p-7">
            <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800">
              <Sparkles className="size-3.5" /> Campaign control
            </p>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-neutral-950 sm:text-3xl">Order activity</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-neutral-600">
              Follow delivery progress, check provider updates, and manage eligible orders from one place.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900">
              <span className="size-2 rounded-full bg-emerald-500" />
              Live status updates every 15 seconds
            </div>
          </div>
          <div className="orders-filter-wrap border-t border-neutral-200 bg-slate-50/80 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-neutral-900">Find an order</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">Search by link or order ID, or filter by status.</p>
              </div>
              <ArrowUpRight className="size-4 text-teal-700" />
            </div>
            <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]" action="/dashboard/orders">
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
      </section>
      <OrderLiveList initialOrders={liveOrders} q={q} status={status} />
    </AppShell>
  );
}
