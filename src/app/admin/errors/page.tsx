import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { Provider, ProviderLog, SyncStatus } from "@/models";
import { AlertTriangle } from "lucide-react";

function JsonBlock({ value }: { value: unknown }) {
  if (!value) return null;
  return (
    <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-neutral-950 p-3 text-xs text-neutral-50">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function formatDate(value?: string | Date) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN");
}

export default async function AdminErrorsPage() {
  let providerLogs: Array<{
    _id: string;
    scope: string;
    action: string;
    message: string;
    details?: unknown;
    createdAt: Date;
    provider?: { name?: string };
  }> = [];
  let syncFailures: Array<{ _id: string; taskType: string; message?: string; updatedAt: Date; details?: unknown }> = [];
  let providerIssues: Array<{ _id: string; name: string; apiUrl?: string; lastError?: string; updatedAt: Date }> = [];

  try {
    await requireAdmin();
    [providerLogs, syncFailures, providerIssues] = await Promise.all([
      ProviderLog.find({ level: "error" }).populate("provider", "name").sort({ createdAt: -1 }).limit(100).lean(),
      SyncStatus.find({ status: "failed" }).sort({ updatedAt: -1 }).limit(50).lean(),
      Provider.find({ lastError: { $exists: true, $nin: [null, ""] } }).select("name apiUrl lastError updatedAt").sort({ updatedAt: -1 }).limit(50).lean(),
    ]) as [typeof providerLogs, typeof syncFailures, typeof providerIssues];
  } catch {
    providerLogs = [];
    syncFailures = [];
    providerIssues = [];
  }

  const hasErrors = providerLogs.length > 0 || syncFailures.length > 0 || providerIssues.length > 0;

  return (
    <AppShell>
      <AdminHeader
        eyebrow="System health"
        title="Errors"
        description="Provider, catalog sync, and backend operation failures visible only to admins."
      />

      {!hasErrors ? (
        <AdminEmptyState icon={AlertTriangle} title="No errors found" description="Recent provider and sync operations have no recorded failures." />
      ) : (
        <div className="grid gap-6">
          <AdminSection title="Provider errors" description="Recent provider API and order routing failures" icon={AlertTriangle}>
            {providerLogs.map((log) => (
              <details key={String(log._id)} className="border-b border-neutral-100 p-4 text-sm">
                <summary className="cursor-pointer list-none">
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_180px] md:items-center">
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-950">{log.message}</p>
                      <p className="text-neutral-500">
                        {(log.provider?.name ?? "Provider")} / {log.scope} / {log.action}
                      </p>
                    </div>
                    <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">Error</span>
                    <span className="text-neutral-500">{formatDate(log.createdAt)}</span>
                  </div>
                </summary>
                <JsonBlock value={log.details} />
              </details>
            ))}
            {providerLogs.length === 0 && <p className="p-4 text-sm text-neutral-500">No provider errors recorded.</p>}
          </AdminSection>

          <AdminSection title="Failed sync jobs" description="Catalog, price, and status jobs that ended with failure" icon={AlertTriangle}>
            {syncFailures.map((item) => (
              <details key={String(item._id)} className="border-b border-neutral-100 p-4 text-sm">
                <summary className="cursor-pointer list-none">
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px] md:items-center">
                    <div>
                      <p className="font-semibold text-neutral-950">{item.taskType.replace(/_/g, " ")}</p>
                      <p className="text-neutral-500">{item.message ?? "Sync failed"}</p>
                    </div>
                    <span className="text-neutral-500">{formatDate(item.updatedAt)}</span>
                  </div>
                </summary>
                <JsonBlock value={item.details} />
              </details>
            ))}
            {syncFailures.length === 0 && <p className="p-4 text-sm text-neutral-500">No failed sync jobs recorded.</p>}
          </AdminSection>

          <AdminSection title="Provider issues" description="Providers with an active last error" icon={AlertTriangle}>
            {providerIssues.map((provider) => (
              <div key={String(provider._id)} className="grid gap-2 border-b border-neutral-100 p-4 text-sm md:grid-cols-[minmax(0,1fr)_180px] md:items-center">
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-950">{provider.name}</p>
                  {provider.apiUrl && <p className="truncate text-neutral-500">{provider.apiUrl}</p>}
                  <p className="mt-1 text-rose-700">{provider.lastError}</p>
                </div>
                <span className="text-neutral-500">{formatDate(provider.updatedAt)}</span>
              </div>
            ))}
            {providerIssues.length === 0 && <p className="p-4 text-sm text-neutral-500">No provider issues recorded.</p>}
          </AdminSection>
        </div>
      )}
    </AppShell>
  );
}
