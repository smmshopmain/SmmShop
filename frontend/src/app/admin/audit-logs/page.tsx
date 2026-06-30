import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { serverApiJson } from "@/lib/server-api";
import { ClipboardList, Search } from "lucide-react";

function JsonBlock({ value }: { value: unknown }) {
  if (!value) return <span className="text-xs text-neutral-400">None</span>;
  return (
    <pre className="max-h-56 overflow-auto rounded-md bg-neutral-950 p-3 text-xs text-neutral-50">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default async function AuditLogsPage({ searchParams }: { searchParams?: Promise<{ action?: string }> }) {
  const params = await searchParams;
  const action = params?.action?.trim() ?? "";
  let logs: Array<{
    _id: string;
    action: string;
    entity?: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    ip?: string;
    userAgent?: string;
    createdAt: Date;
    actor?: { name?: string; email?: string };
  }> = [];

  try {
    const data = await serverApiJson(`/api/admin/audit-logs?action=${encodeURIComponent(action)}`);
    logs = data.logs ?? [];
  } catch {
    logs = [];
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Security trail"
        title="Audit logs"
        description="Admin actions, entity changes, and detailed before/after records for accountability."
        actions={
        <form className="flex gap-2" action="/admin/audit-logs">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-neutral-400" />
          <input
            name="action"
            defaultValue={action}
            placeholder="Filter action"
            className="h-11 w-64 rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
          />
          </label>
          <button className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">Filter</button>
        </form>
        }
      />
      <AdminSection title="Audit trail" description="Expandable before/after change details" icon={ClipboardList}>
        {logs.map((log) => (
          <details key={String(log._id)} className="border-b border-neutral-100 p-4 text-sm">
            <summary className="cursor-pointer list-none">
              <div className="grid gap-2 md:grid-cols-[1fr_180px_180px]">
                <div>
                  <p className="font-semibold text-neutral-950">{log.action}</p>
                  <p className="text-neutral-500">
                    {log.entity ?? "Entity"} {log.entityId ?? ""}
                  </p>
                </div>
                <span>{log.actor?.email ?? "System"}</span>
                <span className="text-neutral-500">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            </summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase text-neutral-500">Before</h2>
                <JsonBlock value={log.before} />
              </div>
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase text-neutral-500">After</h2>
                <JsonBlock value={log.after} />
              </div>
            </div>
          </details>
        ))}
        {logs.length === 0 && <AdminEmptyState icon={ClipboardList} title="No audit logs found" description="Try a different action filter or wait for admin activity." />}
      </AdminSection>
    </AppShell>
  );
}
