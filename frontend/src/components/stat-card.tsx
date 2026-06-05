import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "teal",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "teal" | "amber" | "rose" | "neutral";
}) {
  const tones = {
    teal: "bg-teal-50 text-teal-800",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-800",
    neutral: "bg-neutral-100 text-neutral-800",
  };

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-neutral-500">{label}</p>
        <span className={`grid size-9 place-items-center rounded-md ${tones[tone]}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}
