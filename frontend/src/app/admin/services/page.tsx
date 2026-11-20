"use client";

import { useEffect, useState } from "react";
import { ActionButton, ServiceAdminList, SyncStatusPanel, type AdminServiceItem } from "@/components/admin-controls";
import { AdminHeader } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { apiJson } from "@/lib/client-api";
import { Search } from "lucide-react";

export default function AdminServicesPage() {
  const [services, setServices] = useState<AdminServiceItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      setError("");
      apiJson(`/api/admin/services?q=${encodeURIComponent(query.trim())}`)
        .then(({ services: records = [] }) => {
          if (!mounted) return;
          setServices(
            (records as Array<Omit<AdminServiceItem, "_id"> & { _id: unknown }>).map((service) => ({
              ...service,
              _id: String(service._id),
              provider: service.provider ? { name: service.provider.name } : undefined,
            })),
          );
        })
        .catch((requestError: unknown) => {
          if (!mounted) return;
          setServices([]);
          setError(requestError instanceof Error ? requestError.message : "Unable to load services.");
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }, 250);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Catalog operations"
        title="Service admin"
        description="Control service visibility, category/service margins, and provider catalog sync."
        actions={
          <>
            <label className="relative block min-w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                maxLength={100}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or provider ID"
                aria-label="Search services by name or provider ID"
                className="h-10 w-full rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-sm"
              />
            </label>
            <ActionButton label="Import services" endpoint="/api/cron/service-import" method="GET" />
            <ActionButton label="Sync services" endpoint="/api/cron/service-sync" method="GET" />
            <ActionButton label="Recalculate prices" endpoint="/api/cron/price-sync" method="GET" />
          </>
        }
      />
      <SyncStatusPanel />
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</p>}
      {loading && <p className="mb-3 text-xs font-medium text-neutral-500">Searching service catalog…</p>}
      <ServiceAdminList services={services} />
    </AppShell>
  );
}
