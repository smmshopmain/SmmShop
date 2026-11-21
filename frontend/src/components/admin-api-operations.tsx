"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/client-api";
import { Code2, History, Layers3, Search, ShoppingBag } from "lucide-react";
import type { Route } from "next";

type ApiOperationsKind = "orders" | "services" | "sync-history";
type ApiOrder = {
  _id: string;
  status: string;
  link: string;
  quantity: number;
  sellingPrice: number;
  providerOrderId?: string;
  createdAt: string;
  hasRefund: boolean;
  apiKeyName?: string;
  adminReverifiedAt?: string;
  user?: { name?: string; email?: string } | null;
  service?: { name?: string; category?: string } | null;
};
type ApiServiceMapping = {
  id: string;
  externalId: string;
  status: string;
  effectiveStatus: string;
  importedAt: string;
  lastSyncedAt?: string | null;
  user?: { name?: string; email?: string } | null;
  service?: {
    name?: string;
    category?: string;
    active?: boolean;
    provider?: { name?: string; enabled?: boolean } | null;
  } | null;
};
type ApiSyncLog = {
  _id: string;
  action: string;
  endpoint: string;
  success: boolean;
  statusCode: number;
  errorCode?: string;
  durationMs: number;
  ip?: string;
  createdAt: string;
  user?: { name?: string; email?: string } | null;
  apiKey?: { name?: string; prefix?: string } | null;
};

const pageConfig: Record<ApiOperationsKind, { title: string; description: string; section: string }> = {
  orders: {
    title: "API Orders",
    description: "Review reseller API orders, customer, service, provider status, and wallet refunds.",
    section: "API order ledger",
  },
  services: {
    title: "API Services",
    description: "Inspect customer service mappings and their current availability.",
    section: "Imported service mappings",
  },
  "sync-history": {
    title: "API Sync History",
    description: "Review automatic sync, manual sync, import, and catalog synchronization results.",
    section: "Service synchronization events",
  },
};

const navigation: Array<{ kind: ApiOperationsKind; href: Route; label: string }> = [
  { kind: "orders", href: "/admin/api/orders" as Route, label: "Orders" },
  { kind: "services", href: "/admin/api/services" as Route, label: "Services" },
  { kind: "sync-history", href: "/admin/api/sync-history" as Route, label: "Sync history" },
];

export function AdminApiOperations({ kind }: { kind: ApiOperationsKind }) {
  const config = pageConfig[kind];
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [services, setServices] = useState<ApiServiceMapping[]>([]);
  const [logs, setLogs] = useState<ApiSyncLog[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [summary, setSummary] = useState<{ active?: number; unavailable?: number; byStatus?: Array<{ status: string; count: number; charges: number }> }>({});
  const [message, setMessage] = useState("");
  const [busyOrder, setBusyOrder] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    if (status) params.set(kind === "sync-history" ? "success" : "status", status);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const response = await apiFetch(`/api/admin/api/${kind}?${params.toString()}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result?.ok) throw new Error(result?.message ?? "Unable to load API operations.");
    const data = result.data;
    setTotal(data.total ?? 0);
    setPages(data.pages ?? 0);
    if (kind === "orders") {
      setOrders(data.orders ?? []);
      setSummary({ byStatus: data.stats ?? [] });
    } else if (kind === "services") {
      setServices(data.services ?? []);
      setSummary(data.summary ?? {});
    } else {
      setLogs(data.logs ?? []);
      setSummary({});
    }
    setMessage("");
  }, [fromDate, kind, page, query, status, toDate]);

  async function updateOrder(id: string, action: "cancel" | "complete" | "reverify") {
    const prompts = {
      cancel: "Cancel this API order? The existing website cancellation and refund rules will apply.",
      complete: "Mark this API order as completed? This does not issue a refund.",
      reverify: "Request the current provider status for this API order?",
    };
    if (!window.confirm(prompts[action])) return;
    setBusyOrder(id);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? "Unable to update API order.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update API order.");
    } finally {
      setBusyOrder("");
    }
  }

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(load)
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "Unable to load API operations.");
      });
    return () => {
      active = false;
    };
  }, [load]);

  const icon = kind === "orders" ? ShoppingBag : kind === "services" ? Layers3 : History;
  return (
    <AppShell>
      <AdminHeader eyebrow="Reseller operations" title={config.title} description={config.description} />
      <nav aria-label="API operations" className="mb-5 flex flex-wrap gap-2">
        {navigation.map((item) => (
          <Link
            key={item.kind}
            href={item.href}
            aria-current={kind === item.kind ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${kind === item.kind ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}
          >
            {item.label}
          </Link>
        ))}
        <Link href="/admin/api" className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700">
          Overview
        </Link>
      </nav>
      {message && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</p>}

      {kind === "services" && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className="surface-card rounded-2xl border border-neutral-200 p-4"><p className="text-xs font-semibold text-neutral-500">Active mappings</p><p className="mt-1 text-2xl font-extrabold">{summary.active ?? 0}</p></div>
          <div className="surface-card rounded-2xl border border-neutral-200 p-4"><p className="text-xs font-semibold text-neutral-500">Unavailable mappings</p><p className="mt-1 text-2xl font-extrabold">{summary.unavailable ?? 0}</p></div>
        </div>
      )}
      {kind === "orders" && summary.byStatus && (
        <div className="mb-5 flex flex-wrap gap-2">
          {summary.byStatus.map((item) => (
            <span key={item.status} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
              {item.status}: {item.count} · Rs.{Number(item.charges).toFixed(2)}
            </span>
          ))}
        </div>
      )}

      <AdminSection title={config.section} description={`${total} matching records`} icon={icon}>
        <form className="flex flex-wrap gap-2 border-b border-neutral-100 p-4" onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}>
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-neutral-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={kind === "orders" ? "Search link, order ID, or provider ID" : kind === "services" ? "Search customer, service, or external ID" : "Search sync action, endpoint, or user"} className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm" />
          </label>
          {kind === "orders" && (
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              <option value="">All statuses</option>
              {["Scheduled", "Pending", "Processing", "In Progress", "Completed", "Partial", "Canceled", "Failed"].map((item) => <option key={item}>{item}</option>)}
            </select>
          )}
          {kind === "services" && (
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              <option value="">All availability</option><option value="active">Active</option><option value="unavailable">Unavailable</option>
            </select>
          )}
          {kind === "sync-history" && (
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              <option value="">All results</option><option value="true">Successful</option><option value="false">Failed</option>
            </select>
          )}
          {(kind === "orders" || kind === "sync-history") && (
            <>
              <label className="sr-only" htmlFor="api-operations-from">From date</label>
              <input id="api-operations-from" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
              <label className="sr-only" htmlFor="api-operations-to">To date</label>
              <input id="api-operations-to" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </>
          )}
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">Search</button>
        </form>

        {kind === "orders" && orders.map((order) => (
          <article key={order._id} className="grid gap-2 border-b border-neutral-100 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="font-bold text-neutral-950">{order.service?.name ?? "Service"} · {order._id}</p><p className="text-xs text-neutral-500">{order.user?.name ?? "Customer"} · {order.user?.email ?? "Unknown email"} · key: {order.apiKeyName ?? "Unavailable"}</p></div>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-xs text-neutral-600">{order.service?.category ?? "Uncategorized"} · quantity {order.quantity} · charge Rs.{Number(order.sellingPrice).toFixed(2)} · provider order {order.providerOrderId ?? "not submitted"}{order.hasRefund ? " · refunded" : ""}</p>
            <a href={order.link} target="_blank" rel="noreferrer" className="break-all text-xs text-teal-800 underline">{order.link}</a>
            <time className="text-xs text-neutral-500">{new Date(order.createdAt).toLocaleString()}</time>
            <div className="flex flex-wrap gap-2">
              {["Scheduled", "Pending", "Processing", "In Progress"].includes(order.status) && (
                <button type="button" disabled={busyOrder === order._id} onClick={() => void updateOrder(order._id, "cancel")} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50">Cancel order</button>
              )}
              {order.status !== "Completed" && !order.hasRefund && (
                <button type="button" disabled={busyOrder === order._id} onClick={() => void updateOrder(order._id, "complete")} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Mark completed</button>
              )}
              {order.providerOrderId && !order.adminReverifiedAt && (
                <button type="button" disabled={busyOrder === order._id} onClick={() => void updateOrder(order._id, "reverify")} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Reverify provider</button>
              )}
              {busyOrder === order._id && <span className="self-center text-xs text-neutral-500">Saving…</span>}
            </div>
          </article>
        ))}
        {kind === "services" && services.map((mapping) => (
          <article key={mapping.id} className="grid gap-1 border-b border-neutral-100 p-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
            <div><p className="font-bold text-neutral-950">{mapping.service?.name ?? "Deleted service"}</p><p className="text-xs text-neutral-500">{mapping.user?.name ?? "Customer"} · {mapping.user?.email ?? "Unknown email"} · {mapping.service?.category ?? "Uncategorized"}</p><p className="text-xs text-neutral-500">External ID {mapping.externalId} · provider {mapping.service?.provider?.name ?? "Unavailable"}</p></div>
            <div className="text-left sm:text-right"><StatusBadge status={mapping.effectiveStatus} /><p className="mt-1 text-xs text-neutral-500">{mapping.lastSyncedAt ? `Synced ${new Date(mapping.lastSyncedAt).toLocaleString()}` : `Imported ${new Date(mapping.importedAt).toLocaleString()}`}</p></div>
          </article>
        ))}
        {kind === "sync-history" && logs.map((log) => (
          <article key={log._id} className="grid gap-1 border-b border-neutral-100 p-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
            <div><p className="font-semibold text-neutral-950">{log.action} · {log.statusCode} · {log.durationMs} ms</p><p className="text-xs text-neutral-500">{log.user?.email ?? "System"} · {log.apiKey?.prefix ?? "Scheduled/session sync"} · {log.endpoint}</p>{log.errorCode && <p className="text-xs text-rose-700">{log.errorCode}</p>}</div>
            <div className="flex items-center gap-2"><StatusBadge status={log.success ? "Completed" : "Failed"} /><time className="text-xs text-neutral-500">{new Date(log.createdAt).toLocaleString()}</time></div>
          </article>
        ))}
        {((kind === "orders" && orders.length === 0) || (kind === "services" && services.length === 0) || (kind === "sync-history" && logs.length === 0)) && (
          <AdminEmptyState icon={Code2} title="No API records found" description="Try another search or check back after API activity." />
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between p-4">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40">Previous</button>
            <span className="text-xs text-neutral-500">Page {page} of {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40">Next</button>
          </div>
        )}
      </AdminSection>
    </AppShell>
  );
}
