"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ActionButton } from "@/components/admin-controls";
import { StatusBadge } from "@/components/status-badge";
import { apiJson } from "@/lib/client-api";
 
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}
 
export default function OrdersPage() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim();
  const status = (searchParams.get("status") ?? "").trim();
  const [orders, setOrders] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await apiJson(`/api/orders?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`);
        const payload = res?.orders ?? res?.data ?? res ?? [];
        if (mounted) setOrders(Array.isArray(payload) ? payload : payload.orders ?? []);
      } catch {
        if (mounted) setOrders([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [q, status]);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Order history</h1>
          <p className="mt-1 text-sm text-neutral-600">Search by link/order id and filter by status.</p>
        </div>
        <form className="grid gap-2 sm:grid-cols-[1fr_150px_auto]" action="/dashboard/orders">
          <input name="q" defaultValue={q} placeholder="Search orders" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <select name="status" defaultValue={status} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {['Pending', 'Processing', 'In Progress', 'Completed', 'Partial', 'Canceled'].map((item) => (
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
            <div key={String(order._id)} className="grid gap-4 p-4 text-sm xl:grid-cols-[minmax(220px,1fr)_180px_120px_110px_110px_110px_120px_170px]">
              <div className="min-w-0">
                <p className="font-medium">{order.service?.name ?? "Service"}</p>
                <p className="truncate text-neutral-500">{order.link}</p>
                <p className="mt-1 text-xs text-neutral-500">Order ID: {String(order._id)}</p>
                <p className="text-xs text-neutral-500">Provider Order ID: {order.providerOrderId ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-400">Quantity</p>
                <p>{order.quantity}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-400">Status</p>
                <StatusBadge status={order.status} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-400">Start Count</p>
                <p>{order.startCount ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-400">Remains</p>
                <p>{order.remains ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-400">Charge</p>
                <p className="font-semibold">Rs.{order.sellingPrice}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-400">Time</p>
                <p>Created: {new Date(order.createdAt).toLocaleString()}</p>
                <p className="text-neutral-500">Updated: {new Date(order.updatedAt).toLocaleString()}</p>
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
          {orders.length === 0 && <p className="p-6 text-sm text-neutral-500">No orders yet.</p>}
        </div>
      </section>
    </AppShell>
  );
}
