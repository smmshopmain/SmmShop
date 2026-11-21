"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Code2, KeyRound, Users } from "lucide-react";
import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/client-api";

type ApiUser = {
  id: string;
  name: string;
  email: string;
  accessEnabled: boolean;
  discountPercent: number | null;
  allowedIps: string[];
  registrationDate?: string;
  keyCount: number;
  activeKeyCount: number;
  orderCount: number;
  spending: number;
  lastActivity?: string | null;
  keys: Array<{ id: string; name: string; prefix: string; revokedAt?: string | null; lastUsedAt?: string | null }>;
};

type ApiDashboard = {
  users: number;
  activeUsers: number;
  disabledUsers: number;
  totalOrders: number;
  todayOrders: number;
  totalRequests: number;
  todayRequests: number;
  failedRequests: number;
  averageResponseTimeMs: number;
  errorRatePercent: number;
  activeKeys: number;
  totalKeys: number;
  revenue: number;
  completedOrders: number;
  pendingOrders: number;
  failedOrders: number;
};

type ApiLog = {
  _id: string;
  user?: { name?: string; email?: string } | null;
  apiKey?: { name?: string; prefix?: string } | null;
  endpoint: string;
  action?: string;
  success: boolean;
  statusCode: number;
  errorCode?: string;
  durationMs: number;
  ip?: string;
  createdAt: string;
};

export default function AdminApiPage() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [stats, setStats] = useState<ApiDashboard | null>(null);
  const [allowOverrides, setAllowOverrides] = useState(false);
  const [enforceIpAllowlist, setEnforceIpAllowlist] = useState(false);
  const [query, setQuery] = useState("");
  const [logFilter, setLogFilter] = useState("");
  const [logEndpoint, setLogEndpoint] = useState("");
  const [logFrom, setLogFrom] = useState("");
  const [logTo, setLogTo] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logPages, setLogPages] = useState(0);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (logFilter) params.set("success", logFilter);
    if (logEndpoint) params.set("endpoint", logEndpoint);
    if (logFrom) params.set("from", logFrom);
    if (logTo) params.set("to", logTo);
    params.set("userPage", String(userPage));
    params.set("page", String(logPage));
    const serializedParams = params.toString();
    const response = await apiFetch(`/api/admin/api${serializedParams ? `?${serializedParams}` : ""}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result?.ok) throw new Error(result?.message ?? "Unable to load API management.");
    setUsers(result.data.users ?? []);
    setStats(result.data.stats ?? null);
    setLogs(result.data.logs ?? []);
    setUsersTotal(result.data.usersTotal ?? 0);
    setUserPages(result.data.usersPages ?? 0);
    setLogPages(result.data.logsPages ?? 0);
    setAllowOverrides(result.data.settings?.allowUserDiscountOverrides === true);
    setEnforceIpAllowlist(result.data.settings?.enforceIpAllowlist === true);
  }, [logEndpoint, logFilter, logFrom, logPage, logTo, query, userPage]);

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(load)
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "Unable to load API management.");
      });
    return () => {
      active = false;
    };
  }, [load]);

  async function update(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin/api", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? "Unable to update API access.");
      setMessage(result.data?.message ?? "API settings updated.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update API access.");
    } finally {
      setBusy("");
    }
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Reseller operations"
        title="API Management"
        description="Review API usage and orders, manage API user access and revoke credentials. Global API controls remain under Admin Settings."
      />
      <nav aria-label="API operations" className="mb-5 flex flex-wrap gap-2">
        <Link href="/admin/api/orders" className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700">API Orders</Link>
        <Link href="/admin/api/services" className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700">API Services</Link>
        <Link href="/admin/api/sync-history" className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700">API Sync History</Link>
      </nav>
      {message && <p role="status" className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">{message}</p>}
      {stats && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["API users", stats.users],
            ["Enabled users", stats.activeUsers],
            ["API orders", stats.totalOrders],
            ["Today's API orders", stats.todayOrders],
            ["API requests", stats.totalRequests],
            ["Today's API requests", stats.todayRequests],
            ["Failed requests", stats.failedRequests],
            ["API error rate", `${stats.errorRatePercent}%`],
            ["Average response", `${stats.averageResponseTimeMs} ms`],
            ["Disabled users", stats.disabledUsers],
            ["Active API keys", `${stats.activeKeys}/${stats.totalKeys}`],
            ["Completed orders", stats.completedOrders],
            ["Pending orders", stats.pendingOrders],
            ["Failed orders", stats.failedOrders],
            ["API order revenue", `Rs.${Number(stats.revenue).toFixed(2)}`],
          ].map(([label, value]) => (
            <div key={label} className="surface-card rounded-2xl border border-neutral-200 p-4">
              <p className="text-xs font-semibold text-neutral-500">{label}</p>
              <p className="mt-1 text-2xl font-extrabold text-neutral-950">{value}</p>
            </div>
          ))}
        </div>
      )}
      <AdminSection title="API users" description="Only users who have generated an API key appear here." icon={Users}>
        {enforceIpAllowlist && (
          <p className="border-b border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            IP allowlists are enforced globally. Users without a listed, trusted client IP cannot call the API.
          </p>
        )}
        <form className="flex flex-wrap gap-2 border-b border-neutral-100 p-4" onSubmit={(event) => { event.preventDefault(); setUserPage(1); }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">Search</button>
        </form>
        {users.map((user) => (
          <div key={user.id} className="grid gap-3 border-b border-neutral-100 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-neutral-950">{user.name}</p>
                <p className="text-neutral-500">{user.email} · {user.id}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {user.activeKeyCount}/{user.keyCount} active keys · {user.orderCount} orders · Rs.{Number(user.spending).toFixed(2)} spent
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={user.accessEnabled ? "Approved" : "Canceled"} />
                <button type="button" disabled={Boolean(busy)} onClick={() => void update({ action: "access", userId: user.id, enabled: !user.accessEnabled }, user.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${user.accessEnabled ? "bg-rose-700" : "bg-teal-700"}`}>
                  {busy === user.id ? "Saving..." : user.accessEnabled ? "Disable API" : "Enable API"}
                </button>
              </div>
              {enforceIpAllowlist && user.allowedIps.length === 0 && (
                <p className="text-xs font-medium text-amber-800">API calls are blocked until at least one trusted client IP is added.</p>
              )}
            </div>
            {allowOverrides && (
              <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const value = String(formData.get("discount") ?? "").trim();
                void update({ action: "discount", userId: user.id, discountPercent: value === "" ? null : Number(value) }, `discount-${user.id}`);
              }}>
                <label className="text-xs font-semibold text-neutral-700">Discount override (%)</label>
                <input name="discount" type="number" min={0} max={100} step="0.01" defaultValue={user.discountPercent ?? ""} className="w-28 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs" />
                <button disabled={Boolean(busy)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Save</button>
              </form>
            )}
            <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const allowedIps = String(formData.get("allowedIps") ?? "")
                .split(/\r?\n/)
                .map((ip) => ip.trim())
                .filter(Boolean);
              void update({ action: "ip-allowlist", userId: user.id, allowedIps }, `ips-${user.id}`);
            }}>
              <label className="text-xs font-semibold text-neutral-700">
                Allowed IPs (one exact IPv4/IPv6 address per line)
                <textarea name="allowedIps" rows={2} maxLength={3300} defaultValue={(user.allowedIps ?? []).join("\n")} placeholder="203.0.113.10" className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs" />
              </label>
              <button disabled={Boolean(busy)} className="self-end rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">
                {busy === `ips-${user.id}` ? "Saving..." : "Save IPs"}
              </button>
            </form>
            {user.keys.length > 0 && (
              <details className="rounded-lg border border-neutral-200 px-3 py-2">
                <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-neutral-700"><KeyRound className="size-3.5" /> API keys ({user.keys.length})</summary>
                <div className="mt-2 divide-y divide-neutral-100">
                  {user.keys.map((key) => (
                    <div key={key.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                      <span>{key.name} · <code>{key.prefix}••••</code> · {key.revokedAt ? "Revoked" : "Active"}</span>
                      {!key.revokedAt && <button type="button" disabled={Boolean(busy)} onClick={() => void update({ action: "revoke", keyId: key.id }, key.id)} className="rounded border border-rose-200 px-2 py-1 font-semibold text-rose-700 disabled:opacity-50">Revoke</button>}
                    </div>
                  ))}
                </div>
              </details>
            )}
            {user.lastActivity && <p className="text-xs text-neutral-500">Last API activity: {new Date(user.lastActivity).toLocaleString()}</p>}
          </div>
        ))}
        {users.length === 0 && <AdminEmptyState icon={Code2} title="No API users found" description="Users appear here after generating their first API key." />}
        {userPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-100 p-4">
            <button type="button" disabled={userPage <= 1} onClick={() => setUserPage((current) => current - 1)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40">Previous</button>
            <span className="text-xs text-neutral-500">Showing {users.length} of {usersTotal} · page {userPage}/{userPages}</span>
            <button type="button" disabled={userPage >= userPages} onClick={() => setUserPage((current) => current + 1)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40">Next</button>
          </div>
        )}
      </AdminSection>
      <AdminSection title="API request logs" description="Recent requests with key secrets excluded; logs are retained for 90 days." icon={Code2}>
        <div className="flex flex-wrap items-end gap-2 border-b border-neutral-100 p-4">
          <label className="text-xs font-semibold text-neutral-700">Endpoint
            <input value={logEndpoint} onChange={(event) => { setLogEndpoint(event.target.value); setLogPage(1); }} placeholder="/api/v1/orders" className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-xs" />
          </label>
          <label className="text-xs font-semibold text-neutral-700">From
            <input type="date" value={logFrom} onChange={(event) => { setLogFrom(event.target.value); setLogPage(1); }} className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-xs" />
          </label>
          <label className="text-xs font-semibold text-neutral-700">To
            <input type="date" value={logTo} onChange={(event) => { setLogTo(event.target.value); setLogPage(1); }} className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-xs" />
          </label>
          {[
            ["", "All"],
            ["true", "Successful"],
            ["false", "Failed"],
          ].map(([value, label]) => (
            <button key={value || "all"} type="button" onClick={() => setLogFilter(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${logFilter === value ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-700"}`}>
              {label}
            </button>
          ))}
        </div>
        {logs.map((log) => (
          <div key={log._id} className="grid gap-1 border-b border-neutral-100 p-4 text-xs sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="font-semibold text-neutral-900">{log.action ?? log.endpoint} · {log.statusCode} · {log.durationMs} ms</p>
              <p className="text-neutral-500">{log.user?.email ?? "Unknown user"} · {log.apiKey?.prefix ?? "No key"} · {log.ip ?? "IP unavailable"} · {log.errorCode ?? "Success"}</p>
              <p className="text-neutral-500">{log.endpoint}</p>
            </div>
            <span className={log.success ? "text-teal-700" : "text-rose-700"}>{new Date(log.createdAt).toLocaleString()}</span>
          </div>
        ))}
        {logs.length === 0 && <p className="p-4 text-sm text-neutral-500">No API requests match this filter.</p>}
        {logPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-100 p-4">
            <button type="button" disabled={logPage <= 1} onClick={() => setLogPage((current) => current - 1)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40">Previous</button>
            <span className="text-xs text-neutral-500">Log page {logPage}/{logPages}</span>
            <button type="button" disabled={logPage >= logPages} onClick={() => setLogPage((current) => current + 1)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40">Next</button>
          </div>
        )}
      </AdminSection>
    </AppShell>
  );
}
