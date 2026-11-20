"use client";

import { ActionButton } from "@/components/admin-controls";
import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { CopyTargetLink } from "@/components/copy-target-link";
import { StatusBadge } from "@/components/status-badge";
import { apiJson } from "@/lib/client-api";
import { Search, ShoppingBag, SlidersHorizontal } from "lucide-react";
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
    hasRefund?: boolean;
    adminCompletedAt?: string;
    adminReverifiedAt?: string;
    providerResponse?: {
      lastStatus?: { status?: string };
      cancellationAttempt?: { attempted?: boolean; accepted?: boolean; error?: string };
    };
    user?: { email?: string };
    service?: { name?: string; cancel?: boolean };
    createdAt: Date;
};

function canCancelOrder(order: AdminOrder) {
  return ["Scheduled", "Pending", "Processing", "In Progress"].includes(order.status);
}

function canManuallyCompleteOrder(order: AdminOrder) {
  return order.status !== "Completed" && !order.hasRefund;
}

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
      .catch(() => {
        if (mounted) setOrders([]);
      });
    return () => {
      mounted = false;
    };
  }, [q, status]);

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Order operations"
        title="Orders"
        description="Search, filter, and cancel orders. If the provider does not confirm, cancellation is still recorded on this website."
        actions={
        <form className="grid gap-2 sm:grid-cols-[1fr_150px_auto]" action="/admin/orders">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-neutral-400" />
            <input name="q" defaultValue={q} placeholder="Search orders" className="h-11 w-full rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10" />
          </label>
          <select name="status" defaultValue={status} className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10">
            <option value="">All statuses</option>
            {["Scheduled", "Pending", "Processing", "In Progress", "Completed", "Partial", "Canceled", "Failed"].map((item) => (
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
        <div className="hidden border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-500 xl:grid xl:grid-cols-[minmax(0,1fr)_170px_110px_100px_180px]">
          <span>Order</span>
          <span>Created</span>
          <span>Status</span>
          <span>Charge</span>
          <span>Action</span>
        </div>
        {orders.map((order) => (
          <div key={String(order._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm xl:grid-cols-[minmax(0,1fr)_170px_110px_100px_180px] xl:items-center">
            <div className="min-w-0">
              <p className="font-semibold text-neutral-950">{order.service?.name ?? "Service"}</p>
              <p className="text-neutral-500">{order.user?.email ?? "User"} / {order.providerOrderId ?? "-"}</p>
              <p className="text-neutral-500">
                Start {order.startCount ?? "-"} / Remains {order.status === "Completed" ? 0 : order.remains ?? "-"}
              </p>
              <CopyTargetLink link={order.link} />
            </div>
            <span className="text-neutral-500">{new Date(order.createdAt).toLocaleString()}</span>
            <div>
              <StatusBadge status={order.status} />
              {order.providerResponse?.lastStatus?.status && (
                <p className="mt-1 text-xs text-neutral-500">
                  Provider: {order.providerResponse.lastStatus.status}
                </p>
              )}
              {order.providerResponse?.cancellationAttempt?.attempted && (
                <p className="mt-1 text-xs text-amber-800">
                  {order.providerResponse.cancellationAttempt.accepted
                    ? "Provider accepted cancellation"
                    : "Provider cancellation not confirmed"}
                </p>
              )}
              {order.status === "Canceled" && order.providerResponse?.cancellationAttempt?.attempted === false && (
                <p className="mt-1 text-xs text-neutral-500">Canceled before provider submission</p>
              )}
              {order.adminCompletedAt && <p className="mt-1 text-xs text-teal-800">Manually completed</p>}
              {order.adminReverifiedAt && <p className="mt-1 text-xs text-sky-800">Provider reverified</p>}
              {order.hasRefund && <p className="mt-1 text-xs font-medium text-rose-700">Refunded — cannot mark completed</p>}
            </div>
            <strong>Rs.{order.sellingPrice}</strong>
            <div className="flex flex-col items-start gap-2">
              {canManuallyCompleteOrder(order) && (
                <ActionButton
                  label="Mark completed"
                  endpoint="/api/admin/orders"
                  body={{ id: String(order._id), action: "complete" }}
                  confirmMessage="Mark this order as completed? This will not issue a refund, and the next queued order may start."
                />
              )}
              {order.providerOrderId && !order.adminReverifiedAt && (
                <ActionButton
                  label="Reverify provider"
                  endpoint="/api/admin/orders"
                  body={{ id: String(order._id), action: "reverify" }}
                  confirmMessage="Request this order's current status from the provider? This can be done once by an admin."
                />
              )}
              {canCancelOrder(order) && (
                <ActionButton label="Cancel" endpoint="/api/admin/orders" body={{ id: String(order._id), action: "cancel" }} danger />
              )}
              {!canManuallyCompleteOrder(order) && !order.providerOrderId && !canCancelOrder(order) && (
                <span className="text-xs text-neutral-400">No actions available</span>
              )}
            </div>
          </div>
        ))}
        {orders.length === 0 && <AdminEmptyState icon={ShoppingBag} title="No orders found" description="Try changing the filters or wait for new customer orders." />}
      </AdminSection>
    </AppShell>
  );
}
