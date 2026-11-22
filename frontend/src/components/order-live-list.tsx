"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RefreshCcw, ShoppingBag, Wifi, X } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/admin-controls";
import { CopyTargetLink } from "@/components/copy-target-link";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/client-api";

export type LiveOrder = {
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
  adminCompletedAt?: string;
  cancellationStatus?: "accepted" | "unconfirmed" | "not-submitted";
  service?: { _id?: string; name?: string; refill?: boolean; cancel?: boolean };
};

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function completionText(order: LiveOrder) {
  const remains = order.status === "Completed" ? 0 : typeof order.remains === "number" ? order.remains : null;
  if (remains === null) return "Waiting for updates";
  const done = Math.min(order.quantity, Math.max(0, order.quantity - remains));
  const percent = order.quantity > 0 ? Math.min(100, Math.round((done / order.quantity) * 100)) : 0;
  return `${done}/${order.quantity} completed (${percent}%)`;
}

function canCancelOrder(order: LiveOrder) {
  return ["Scheduled", "Pending", "Processing", "In Progress"].includes(order.status);
}

export function OrderLiveList({
  initialOrders,
  q,
  status,
}: {
  initialOrders: LiveOrder[];
  q: string;
  status: string;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [error, setError] = useState("");
  const [cancelNotice, setCancelNotice] = useState("");
  const [cancelCandidate, setCancelCandidate] = useState<LiveOrder | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const refreshing = useRef(false);
  const lastOrderSyncAttemptAt = useRef(0);

  const refreshOrders = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setLoading(true);
    setError("");
    const shouldSyncOrderStatus = Date.now() - lastOrderSyncAttemptAt.current >= 60000;
    if (shouldSyncOrderStatus) lastOrderSyncAttemptAt.current = Date.now();
    try {
      const endpoint = shouldSyncOrderStatus ? "/api/orders?sync=1" : "/api/orders";
      const response = await apiFetch(endpoint, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        setError("Unable to refresh order status right now.");
        return;
      }
      setOrders(result.data?.orders ?? []);
      setLastUpdated(result.data?.syncedAt ?? new Date().toISOString());
    } catch {
      setError("Unable to refresh order status right now.");
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshOrders();
    }, 30000);

    const initialRefresh = window.setTimeout(() => void refreshOrders(), 250);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(initialRefresh);
    };
  }, [refreshOrders]);

  const visibleOrders = useMemo(() => {
    const search = q.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = status ? order.status === status : true;
      const matchesSearch = search
        ? [
            order.link,
            order._id,
            order.service?.name ?? "",
            order.status,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search)
        : true;
      return matchesStatus && matchesSearch;
    });
  }, [orders, q, status]);

  async function confirmCancelOrder() {
    if (!cancelCandidate) return;
    setCancelLoading(true);
    setCancelError("");
    try {
      const response = await apiFetch("/api/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: cancelCandidate._id, action: "cancel" }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Unable to cancel order.");
      }
      const canceledOrder = result.data?.order as LiveOrder | undefined;
      setOrders((current) =>
        current.map((order) => order._id === cancelCandidate._id
          ? {
              ...order,
              status: "Canceled",
              cancellationStatus: canceledOrder?.cancellationStatus ?? order.cancellationStatus,
            }
          : order),
      );
      setCancelNotice(result.data?.message ?? "Order canceled on the website.");
      setCancelCandidate(null);
      void refreshOrders();
    } catch (cancelRequestError) {
      setCancelError(
        cancelRequestError instanceof Error ? cancelRequestError.message : "Unable to cancel order.",
      );
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <section className="order-list-panel overflow-hidden rounded-[1.5rem] border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Wifi className="size-4 text-teal-700" />
          <span className="font-semibold text-neutral-800">Live order status</span>
          <span className="hidden sm:inline">Auto refresh every 30s</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lastUpdated && <span className="text-xs text-neutral-500">Last updated: {formatDate(lastUpdated)}</span>}
          {error && <span className="text-xs font-medium text-rose-700">{error}</span>}
          <button
            type="button"
            onClick={refreshOrders}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-100 disabled:opacity-60"
          >
            <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh now
          </button>
        </div>
      </div>

      {cancelNotice && (
        <p role="status" className="border-b border-neutral-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
          {cancelNotice}
        </p>
      )}

      <div
        className="order-table-scroll max-w-full overflow-x-auto overscroll-x-contain"
        role="region"
        aria-label="Order list; scroll horizontally to view all columns"
        tabIndex={0}
      >
        <div className="hidden border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-500 xl:grid xl:min-w-[1042px] xl:grid-cols-[minmax(200px,1fr)_100px_115px_100px_100px_80px_145px_170px]">
          <span className="min-w-0">Service</span>
          <span className="min-w-0">Status</span>
          <span className="min-w-0">Order Status</span>
          <span className="min-w-0">Completed</span>
          <span className="min-w-0">Remaining</span>
          <span className="min-w-0">Charge</span>
          <span className="min-w-0">Last updated</span>
          <span className="min-w-0 text-right">Actions</span>
        </div>

        <div className="divide-y divide-neutral-100 xl:min-w-[1042px]">
          {visibleOrders.map((order) => (
            <div
              key={String(order._id)}
              className="order-list-row grid gap-4 p-4 text-sm xl:gap-x-0 xl:grid-cols-[minmax(200px,1fr)_100px_115px_100px_100px_80px_145px_170px] xl:items-start"
            >
              <div className="min-w-0">
                <p className="font-semibold text-neutral-950">{order.service?.name ?? "Service"}</p>
                <CopyTargetLink link={order.link} />
                <p className="mt-1 text-xs text-neutral-500">Order ID: {String(order._id)}</p>
              </div>

              <div className="grid grid-cols-2 gap-1 xl:block">
                <p className="text-xs font-medium uppercase text-neutral-400 xl:hidden">Status</p>
                <StatusBadge status={order.status} />
                {order.adminCompletedAt && (
                  <p className="mt-1 text-xs font-medium text-teal-800">Manually completed by admin</p>
                )}
                {order.cancellationStatus && order.cancellationStatus !== "not-submitted" && (
                  <p className="mt-1 text-xs text-amber-800">
                    {order.cancellationStatus === "accepted"
                      ? "Cancellation request accepted"
                      : "Cancellation could not be confirmed"}
                  </p>
                )}
                {order.status === "Canceled" && order.cancellationStatus === "not-submitted" && (
                  <p className="mt-1 text-xs text-neutral-500">Canceled before processing started</p>
                )}
                {order.status === "Partial" && <p className="mt-1 text-xs font-semibold text-amber-700">Incomplete / Partial</p>}
                {order.status === "Scheduled" && (
                  <p className="mt-1 text-xs font-medium text-indigo-700">
                    Waiting for the previous order on this link
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1 xl:block">
                <p className="text-xs font-medium uppercase text-neutral-400 xl:hidden">Order Status</p>
                <p className="font-semibold text-neutral-800">{order.status}</p>
              </div>

              <div className="grid grid-cols-2 gap-1 xl:block">
                <p className="text-xs font-medium uppercase text-neutral-400 xl:hidden">Completed</p>
                <p className="font-medium">{completionText(order)}</p>
              </div>

              <div className="grid grid-cols-2 gap-1 xl:block">
                <p className="text-xs font-medium uppercase text-neutral-400 xl:hidden">Remaining</p>
                <p className="font-semibold">
                  {order.status === "Completed" ? 0 : typeof order.remains === "number" ? order.remains : "-"}
                </p>
                <p className="text-xs text-neutral-500">Start: {typeof order.startCount === "number" ? order.startCount : "-"}</p>
              </div>

              <div className="grid grid-cols-2 gap-1 xl:block">
                <p className="text-xs font-medium uppercase text-neutral-400 xl:hidden">Charge</p>
                <p className="font-semibold">Rs.{order.sellingPrice}</p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-neutral-400 xl:hidden">Last updated</p>
                <p className="text-neutral-600">{formatDate(order.lastStatusSyncAt)}</p>
                <p className="text-xs text-neutral-500">Created: {formatDate(order.createdAt)}</p>
              </div>

              <div className="flex flex-wrap gap-2 xl:justify-end">
                {order.service?._id && (
                  <Link
                    href={`/dashboard/services?serviceId=${encodeURIComponent(order.service._id)}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-teal-700 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                  >
                    <ShoppingBag className="size-3.5" /> Generate new order
                  </Link>
                )}
                {order.service?.refill && order.status === "Completed" && (
                  <ActionButton label="Refill" endpoint="/api/refills" method="POST" body={{ orderId: String(order._id) }} />
                )}
                {canCancelOrder(order) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelError("");
                      setCancelNotice("");
                      setCancelCandidate(order);
                    }}
                    className="rounded-md bg-rose-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-800"
                  >
                    Cancel
                  </button>
                )}
                {!order.service?.refill && !canCancelOrder(order) && (
                  <span className="text-xs text-neutral-400">No actions</span>
                )}
              </div>
            </div>
          ))}

          {visibleOrders.length === 0 && (
            <div className="grid place-items-center px-4 py-12 text-center">
              <ShoppingBag className="size-10 text-neutral-300" />
              <p className="mt-3 text-sm font-semibold text-neutral-800">No orders found</p>
              <p className="mt-1 max-w-md text-sm text-neutral-500">
                Clear the search/filter or place a new order from the services page.
              </p>
            </div>
          )}
        </div>
      </div>

      {cancelCandidate && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-neutral-950/55 p-4" role="presentation">
          <section
            aria-labelledby="cancel-order-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-700">
                  <AlertTriangle className="size-5" />
                </span>
                <div>
                  <h2 id="cancel-order-title" className="text-lg font-bold text-neutral-950">
                    Cancel this order?
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close confirmation"
                onClick={() => {
                  if (!cancelLoading) setCancelCandidate(null);
                }}
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-5 space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <p lang="hi" className="font-semibold">ऑर्डर कैंसल करने पर कोई रिफंड नहीं मिलेगा।</p>
              <p>Canceling this order will not result in a refund.</p>
              <p>If cancellation is not confirmed, the service may continue even though the order is canceled on this website.</p>
            </div>
            {cancelError && <p className="mt-3 text-sm font-medium text-rose-700">{cancelError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={cancelLoading}
                onClick={() => setCancelCandidate(null)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
              >
                Keep order
              </button>
              <button
                type="button"
                disabled={cancelLoading}
                onClick={confirmCancelOrder}
                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
              >
                {cancelLoading ? "Canceling..." : "Cancel order"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
