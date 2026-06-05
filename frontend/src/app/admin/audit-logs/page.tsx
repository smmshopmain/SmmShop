import { AppShell } from "@/components/app-shell";
import { serverApiJson } from "@/lib/server-api";

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
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit logs</h1>
          <p className="mt-1 text-sm text-neutral-600">Admin actions, entity changes, and detailed before/after records.</p>
        </div>
        <form className="flex gap-2" action="/admin/audit-logs">
          <input
            name="action"
            defaultValue={action}
            placeholder="Filter action"
            className="w-56 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">Filter</button>
        </form>
      </div>
      <section className="rounded-md border border-neutral-200 bg-white">
        {logs.map((log) => (
          <details key={String(log._id)} className="border-b border-neutral-100 p-4 text-sm">
            <summary className="cursor-pointer list-none">
              <div className="grid gap-2 md:grid-cols-[1fr_180px_180px]">
                <div>
                  <p className="font-medium">{log.action}</p>
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
        {logs.length === 0 && <p className="p-4 text-sm text-neutral-500">No audit logs found.</p>}
      </section>
    </AppShell>
  );
}
