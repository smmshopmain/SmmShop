import { ActionButton, SyncStatusPanel } from "@/components/admin-controls";
import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { ProviderEditForm, ProviderForm } from "@/components/provider-form";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireAdmin } from "@/lib/auth";
import { ensureDefaultProviderFromEnv } from "@/lib/provider";
import { Provider } from "@/models";
import { Layers3 } from "lucide-react";

export default async function ProvidersPage() {
  let providers: Array<{
    _id: string;
    name: string;
    apiUrl: string;
    username?: string;
    enabled: boolean;
    priority: number;
    balance: number;
    lastError?: string;
  }> = [];

  try {
    await requireAdmin();
    await ensureDefaultProviderFromEnv();
    providers = (await Provider.find().sort({ priority: 1 }).lean()) as typeof providers;
  } catch {
    providers = [];
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Provider operations"
        title="Provider management"
        description="Manage provider credentials, enablement, priority, balance sync, and service imports."
        actions={
          <>
            <ActionButton label="Import services" endpoint="/api/cron/service-import" method="GET" />
            <ActionButton label="Sync services" endpoint="/api/cron/service-sync" method="GET" />
            <ActionButton label="Provider balance" endpoint="/api/cron/provider-balance" method="GET" />
          </>
        }
      />
      <SyncStatusPanel />
      <div className="mt-4 grid gap-6 xl:grid-cols-[420px_1fr]">
        <ProviderForm />
        <AdminSection title="Connected providers" description="Routing, health and balance controls" icon={Layers3}>
          {providers.map((provider) => (
            <div key={String(provider._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm md:grid-cols-[minmax(0,1fr)_90px_100px_100px_170px] md:items-start">
              <div className="min-w-0">
                <p className="font-semibold text-neutral-950">{provider.name}</p>
                <p className="truncate text-neutral-500">{provider.apiUrl}</p>
                {provider.username && <p className="truncate text-neutral-500">Username: {provider.username}</p>}
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
                <ActionButton
                  label="Force delete"
                  endpoint={`/api/admin/providers?id=${String(provider._id)}&force=true`}
                  method="DELETE"
                  danger
                  confirmMessage="Force delete this provider even if active orders exist?"
                />
              </div>
              <ProviderEditForm
                provider={{
                  _id: String(provider._id),
                  name: provider.name,
                  apiUrl: provider.apiUrl,
                  username: provider.username,
                  priority: provider.priority,
                  enabled: provider.enabled,
                }}
              />
            </div>
          ))}
          {providers.length === 0 && <AdminEmptyState icon={Layers3} title="No providers configured" description="Add a provider to import services and route orders." />}
        </AdminSection>
      </div>
    </AppShell>
  );
}
