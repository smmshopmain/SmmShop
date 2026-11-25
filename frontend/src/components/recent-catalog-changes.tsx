"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CheckCheck, Clock3, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/client-api";

type CatalogChange = {
  _id: string;
  providerServiceId: string;
  serviceName: string;
  changeType: "new" | "updated" | "deactivated";
  changes: Array<{ field: string; previous: unknown; current: unknown }>;
  createdAt: string;
};

const fieldLabels: Record<string, string> = {
  name: "Name",
  category: "Category",
  type: "Type",
  providerRate: "Base rate",
  sellingRate: "Selling price",
  min: "Minimum",
  max: "Maximum",
  refill: "Refill",
  cancel: "Cancel",
  active: "Availability",
};

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function changeTitle(type: CatalogChange["changeType"]) {
  if (type === "new") return "New service";
  if (type === "deactivated") return "Service unavailable";
  return "Service updated";
}

export function RecentCatalogChanges() {
  const [events, setEvents] = useState<CatalogChange[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [beforeCursor, setBeforeCursor] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await apiFetch("/api/admin/catalog-changes");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to load recent catalog changes.");
      const loadedEvents: CatalogChange[] = result.data?.events ?? [];
      setEvents((current) => {
        const byId = new Map(current.map((event) => [event._id, event]));
        loadedEvents.forEach((event) => byId.set(event._id, event));
        return [...byId.values()].sort((left, right) => right._id.localeCompare(left._id));
      });
      setBeforeCursor((current) => current || loadedEvents[loadedEvents.length - 1]?._id || "");
      setUnreadCount(result.data?.unreadCount ?? 0);
      setHasMore((current) => current || Boolean(result.data?.hasMore));
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load recent catalog changes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function loadMore() {
    const cursor = beforeCursor;
    if (!cursor) return;
    setLoadingMore(true);
    setError("");
    try {
      const response = await apiFetch(`/api/admin/catalog-changes?before=${encodeURIComponent(cursor)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to load more catalog changes.");
      const loadedEvents: CatalogChange[] = result.data?.events ?? [];
      const existingIds = new Set(events.map((event) => event._id));
      setEvents((current) => [
        ...current,
        ...loadedEvents.filter((event) => !existingIds.has(event._id)),
      ]);
      setBeforeCursor(loadedEvents[loadedEvents.length - 1]?._id ?? "");
      setUnreadCount(result.data?.unreadCount ?? unreadCount);
      setHasMore(Boolean(result.data?.hasMore));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load more catalog changes.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function markAsRead(id: string) {
    setBusyId(id);
    setError("");
    try {
      const response = await apiFetch("/api/admin/catalog-changes", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to mark this change as read.");
      setEvents((current) => current.filter((event) => event._id !== id));
      setUnreadCount((current) => Math.max(0, current - (result.data?.markedRead ?? 0)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to mark this change as read.");
    } finally {
      setBusyId("");
    }
  }

  async function markAllAsRead() {
    setMarkingAll(true);
    setError("");
    try {
      const response = await apiFetch("/api/admin/catalog-changes", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to mark all changes as read.");
      setEvents([]);
      setUnreadCount(0);
      setHasMore(false);
      setBeforeCursor("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to mark all changes as read.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-950">Recent catalog changes</h2>
            <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-900">
              {unreadCount} unread
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            New services and sync or price changes stay here until you mark them as read.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={markingAll}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            <CheckCheck className="size-4" />
            {markingAll ? "Marking..." : "Mark all as read"}
          </button>
        )}
      </div>

      {error && <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {loading ? (
        <p className="py-8 text-center text-sm text-neutral-500">Loading catalog changes…</p>
      ) : events.length === 0 ? (
        <div className="py-8 text-center">
          <RefreshCw className="mx-auto size-5 text-neutral-400" />
          <p className="mt-2 text-sm font-medium text-neutral-700">You’re all caught up</p>
          <p className="mt-1 text-xs text-neutral-500">New imports and catalog changes will appear here.</p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-neutral-100">
          {events.map((event) => (
            <article key={event._id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      event.changeType === "new"
                        ? "bg-emerald-100 text-emerald-800"
                        : event.changeType === "deactivated"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                    }`}>
                      {changeTitle(event.changeType)}
                    </span>
                    <span className="text-sm font-semibold text-neutral-900">{event.serviceName}</span>
                    <span className="text-xs text-neutral-500">Service ID: {event.providerServiceId}</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {event.changes.map((change, index) => (
                      <div key={`${change.field}-${index}`} className="rounded-md bg-neutral-50 px-3 py-2 text-xs">
                        <p className="font-semibold text-neutral-700">{fieldLabels[change.field] ?? change.field}</p>
                        <p className="mt-1 text-neutral-500">
                          <span className="font-medium text-neutral-700">Before:</span> {formatValue(change.previous)}
                        </p>
                        <p className="text-neutral-700">
                          <span className="font-medium">Now:</span> {formatValue(change.current)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-neutral-500">
                    <Clock3 className="size-3.5" />
                    {new Date(event.createdAt).toLocaleString("en-IN")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void markAsRead(event._id)}
                  disabled={busyId === event._id || markingAll}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-60"
                >
                  <Check className="size-4" />
                  {busyId === event._id ? "Saving..." : "Mark as read"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {hasMore && (
        <div className="mt-4 border-t border-neutral-100 pt-4 text-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load older changes"}
          </button>
        </div>
      )}
    </section>
  );
}
