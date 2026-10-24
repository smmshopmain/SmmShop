import { History } from "lucide-react";

export type LoginHistoryEntry = {
  loggedInAt: string;
  device: string;
  location: string;
};

export function LoginHistoryList({ entries }: { entries: LoginHistoryEntry[] }) {
  if (!entries.length) {
    return <p className="py-3 text-sm text-neutral-500">No login history recorded yet.</p>;
  }

  return (
    <ol className="divide-y divide-neutral-100">
      {entries.map((entry, index) => (
        <li key={`${entry.loggedInAt}-${index}`} className="flex gap-3 py-3">
          <History className="mt-0.5 size-4 shrink-0 text-teal-700" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">{entry.device}</p>
            <p className="mt-1 text-xs text-neutral-600">{entry.location}</p>
            <time className="mt-1 block text-xs text-neutral-500" dateTime={entry.loggedInAt}>
              {formatLoginDate(entry.loggedInAt)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}

function formatLoginDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
