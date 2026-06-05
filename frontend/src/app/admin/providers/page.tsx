"use client";

import React, { useEffect, useState } from "react";
import { ActionButton } from "@/components/admin-controls";
import { ProviderEditForm, ProviderForm } from "@/components/provider-form";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiJson } from "@/lib/client-api";

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const list = await apiJson("/api/admin/providers");
        if (!mounted) return;
        // backend may return { ok: true, providers: [...] } or raw array
        const payload = Array.isArray(list) ? list : list?.providers ?? list?.data ?? [];
        setProviders(payload);
      } catch {
        if (mounted) setProviders([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">Provider management</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        <ActionButton label="Import services" endpoint="/api/cron/service-sync" method="GET" />
        <ActionButton label="Sync services" endpoint="/api/cron/service-sync" method="GET" />
        <ActionButton label="Provider balance" endpoint="/api/cron/provider-balance" method="GET" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <ProviderForm />
        <section className="rounded-md border border-neutral-200 bg-white">
          {loading ? (
            <p className="p-4 text-sm text-neutral-500">Loading providers…</p>
          ) : providers.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">No providers configured.</p>
          ) : (
            providers.map((provider) => (
              <div key={String(provider._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm md:grid-cols-[1fr_90px_100px_100px_170px]">
                <div>
                  <p className="font-medium">{provider.name}</p>
                  <p className="truncate text-neutral-500">{provider.apiUrl}</p>
                  {provider.lastError && <p className="text-rose-700">{provider.lastError}</p>}
                </div>
                <span>#{provider.priority}</span>
                <StatusBadge status={provider.enabled ? "Approved" : "Canceled"} />
                <strong>Rs.{provider.balance ?? 0}</strong>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    label={provider.enabled ? "Disable" : "Enable"}
                    endpoint="/api/admin/providers"
                    body={{ id: String(provider._id), enabled: !provider.enabled }}
                    danger={provider.enabled}
                  />
                  <ActionButton
                    label="Delete"
                    endpoint={`/api/admin/providers?id=${String(provider._id)}`}
                    method="DELETE"
                    danger
                  />
                </div>
                <ProviderEditForm
                  provider={{
                    _id: String(provider._id),
                    name: provider.name,
                    apiUrl: provider.apiUrl,
                    priority: provider.priority,
                    enabled: provider.enabled,
                  }}
                />
              </div>
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
