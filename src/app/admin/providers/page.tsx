import { ActionButton, SyncStatusPanel } from "@/components/admin-controls";
import { ProviderEditForm, ProviderForm } from "@/components/provider-form";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireAdmin } from "@/lib/auth";
import { ensureDefaultProviderFromEnv } from "@/lib/provider";
import { Provider } from "@/models";

export default async function ProvidersPage() {
  let providers: Array<{
    _id: string;
    name: string;
    apiUrl: string;
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
      <h1 className="mb-6 text-2xl font-semibold">Provider management</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        <ActionButton label="Import services" endpoint="/api/cron/service-import" method="GET" />
        <ActionButton label="Sync services" endpoint="/api/cron/service-sync" method="GET" />
        <ActionButton label="Provider balance" endpoint="/api/cron/provider-balance" method="GET" />
      </div>
      <SyncStatusPanel />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <ProviderForm />
        <section className="rounded-md border border-neutral-200 bg-white">
          {providers.map((provider) => (
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
                  priority: provider.priority,
                  enabled: provider.enabled,
                }}
              />
            </div>
          ))}
          {providers.length === 0 && <p className="p-4 text-sm text-neutral-500">No providers configured.</p>}
        </section>
      </div>
    </AppShell>
  );
}
