import type { LucideIcon } from "lucide-react";
import type React from "react";

export function AdminHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="surface-card mb-6 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold text-neutral-950 sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function AdminSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-neutral-200 p-4">
        {Icon && (
          <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-700/10">
            <Icon className="size-5" />
          </span>
        )}
        <div>
          <h2 className="font-bold text-neutral-950">{title}</h2>
          {description && <p className="text-sm text-neutral-500">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function AdminEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="grid place-items-center px-4 py-12 text-center">
      <Icon className="size-10 text-neutral-300" />
      <p className="mt-3 text-sm font-semibold text-neutral-800">{title}</p>
      <p className="mt-1 max-w-md text-sm text-neutral-500">{description}</p>
    </div>
  );
}
