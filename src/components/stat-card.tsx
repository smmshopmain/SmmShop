import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "teal",
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: "teal" | "amber" | "rose" | "neutral";
}) {
  const tones = {
    teal: "bg-teal-50 text-teal-800 ring-teal-700/10",
    amber: "bg-amber-50 text-amber-800 ring-amber-700/10",
    rose: "bg-rose-50 text-rose-800 ring-rose-700/10",
    neutral: "bg-neutral-100 text-neutral-800 ring-neutral-700/10",
  };

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-neutral-500">{label}</p>
        <span className={`grid size-10 place-items-center rounded-md ring-1 ${tones[tone]}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 break-words text-2xl font-bold text-neutral-950">{value}</p>
    </div>
  );
}
