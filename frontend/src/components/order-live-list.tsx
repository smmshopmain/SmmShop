"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, ShoppingBag, Wifi } from "lucide-react";
import { ActionButton } from "@/components/admin-controls";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/client-api";

type ProviderStatusPayload = {
  status?: string;
  start_count?: string | number;
  remains?: string | number;
  charge?: string | number;
};

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
  providerOrderId?: string;
  providerResponse?: { lastStatus?: ProviderStatusPayload };
  service?: { name?: string; refill?: boolean; cancel?: boolean };
};

function providerRawStatus(order: LiveOrder) {
  return order.providerResponse?.lastStatus?.status ? String(order.providerResponse.lastStatus.status) : order.status;
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function completionText(order: LiveOrder) {
  if (typeof order.remains !== "number") return "Waiting for provider";
  const done = Math.max(0, order.quantity - order.remains);
  const percent = order.quantity > 0 ? Math.min(100, Math.round((done / order.quantity) * 100)) : 0;
  return `${done}/${order.quantity} completed (${percent}%)`;
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

  const refreshOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/orders?sync=1", { cache: "no-store" });
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshOrders();
    }, 15000);

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
            order.providerOrderId ?? "",
            order._id,
            order.service?.name ?? "",
            providerRawStatus(order),
          ]
            .join(" ")
            .toLowerCase()
            .includes(search)
        : true;
      return matchesStatus && matchesSearch;
    });
  }, [orders, q, status]);

  return (
    <section className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Wifi className="size-4 text-teal-700" />
          <span className="font-semibold text-neutral-800">Live provider status</span>
          <span className="hidden sm:inline">Auto refresh every 15s</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lastUpdated && <span className="text-xs text-neutral-500">Last sync: {formatDate(lastUpdated)}</span>}
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

      <div className="hidden border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-500 xl:grid xl:grid-cols-[minmax(220px,1fr)_130px_130px_120px_120px_110px_180px_170px]">
        <span>Service</span>
        <span>App status</span>
        <span>Provider status</span>
        <span>Completed</span>
        <span>Remaining</span>
        <span>Charge</span>
        <span>Provider sync</span>
        <span className="text-right">Actions</span>
      </div>

      <div className="divide-y divide-neutral-100">
        {visibleOrders.map((order) => (
          <div
            key={String(order._id)}
            className="grid gap-4 p-4 text-sm xl:grid-cols-[minmax(220px,1fr)_130px_130px_120px_120px_110px_180px_170px] xl:items-center"
          >
            <div className="min-w-0">
              <p className="font-semibold text-neutral-950">{order.service?.name ?? "Service"}</p>
              <p className="truncate text-neutral-500">{order.link}</p>
              <p className="mt-1 text-xs text-neutral-500">Order ID: {String(order._id)}</p>
              <p className="text-xs text-neutral-500">Provider Order ID: {order.providerOrderId ?? "-"}</p>
            </div>

            <div className="grid grid-cols-2 gap-1 xl:block">
              <p className="text-xs font-medium uppercase text-neutral-400">App status</p>
              <StatusBadge status={order.status} />
              {order.status === "Partial" && <p className="mt-1 text-xs font-semibold text-amber-700">Incomplete / Partial</p>}
            </div>

            <div className="grid grid-cols-2 gap-1 xl:block">
              <p className="text-xs font-medium uppercase text-neutral-400">Provider status</p>
              <p className="font-semibold text-neutral-800">{providerRawStatus(order)}</p>
            </div>

            <div className="grid grid-cols-2 gap-1 xl:block">
              <p className="text-xs font-medium uppercase text-neutral-400">Completed</p>
              <p className="font-medium">{completionText(order)}</p>
            </div>

            <div className="grid grid-cols-2 gap-1 xl:block">
              <p className="text-xs font-medium uppercase text-neutral-400">Remaining</p>
              <p className="font-semibold">{typeof order.remains === "number" ? order.remains : "-"}</p>
              <p className="text-xs text-neutral-500">Start: {typeof order.startCount === "number" ? order.startCount : "-"}</p>
            </div>

            <div className="grid grid-cols-2 gap-1 xl:block">
              <p className="text-xs font-medium uppercase text-neutral-400">Charge</p>
              <p className="font-semibold">Rs.{order.sellingPrice}</p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-neutral-400">Provider sync</p>
              <p className="text-neutral-600">{formatDate(order.lastStatusSyncAt)}</p>
              <p className="text-xs text-neutral-500">Created: {formatDate(order.createdAt)}</p>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              {order.service?.refill && order.status === "Completed" && (
                <ActionButton label="Refill" endpoint="/api/refills" method="POST" body={{ orderId: String(order._id) }} />
              )}
              {order.service?.cancel && ["Pending", "Processing", "In Progress", "Partial"].includes(order.status) && (
                <ActionButton label="Cancel" endpoint="/api/orders" body={{ id: String(order._id), action: "cancel" }} danger />
              )}
              {!order.service?.refill && !order.service?.cancel && <span className="text-xs text-neutral-400">No actions</span>}
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
    </section>
  );
}
