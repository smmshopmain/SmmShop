"use client";

import { ActionButton } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiJson } from "@/lib/client-api";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type AdminOrder = {
    _id: string;
    link: string;
    quantity: number;
    status: string;
    sellingPrice: number;
    startCount?: number;
    remains?: number;
    providerOrderId?: string;
    user?: { email?: string };
    service?: { name?: string; cancel?: boolean };
    createdAt: Date;
};

export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  useEffect(() => {
    let mounted = true;
    apiJson(`/api/admin/orders?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`)
      .then((data) => {
        if (!mounted) return;
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      })
      .catch((error) => {
        console.error("Unable to load admin orders", error);
        if (mounted) setOrders([]);
      });
    return () => {
      mounted = false;
    };
  }, [q, status]);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="mt-1 text-sm text-neutral-600">Search, filter, and cancel eligible provider orders.</p>
        </div>
        <form className="grid gap-2 sm:grid-cols-[1fr_150px_auto]" action="/admin/orders">
          <input name="q" defaultValue={q} placeholder="Search orders" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
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
      <section className="rounded-md border border-neutral-200 bg-white">
        {orders.map((order) => (
          <div key={String(order._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm xl:grid-cols-[1fr_170px_110px_100px_120px]">
            <div>
              <p className="font-medium">{order.service?.name ?? "Service"}</p>
              <p className="text-neutral-500">{order.user?.email ?? "User"} / {order.providerOrderId ?? "-"}</p>
              <p className="text-neutral-500">Start {order.startCount ?? "-"} / Remains {order.remains ?? "-"}</p>
              <p className="truncate text-neutral-500">{order.link}</p>
            </div>
            <span>{new Date(order.createdAt).toLocaleString()}</span>
            <StatusBadge status={order.status} />
            <strong>Rs.{order.sellingPrice}</strong>
            {order.service?.cancel && ["Pending", "Processing", "In Progress"].includes(order.status) ? (
              <ActionButton label="Cancel" endpoint="/api/admin/orders" body={{ id: String(order._id), action: "cancel" }} danger />
            ) : (
              <span className="text-xs text-neutral-400">No action</span>
            )}
          </div>
        ))}
        {orders.length === 0 && <p className="p-4 text-sm text-neutral-500">No orders found.</p>}
      </section>
    </AppShell>
  );
}
