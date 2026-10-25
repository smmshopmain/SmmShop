"use client";

import { Code2, ExternalLink } from "lucide-react";

export type DeveloperCreditSettings = {
  enabled: boolean;
  label: string;
  name: string;
  url: string;
};

export const DEFAULT_DEVELOPER_CREDIT: DeveloperCreditSettings = {
  enabled: false,
  label: "Developed by",
  name: "",
  url: "",
};

export function DeveloperCreditFooter({
  settings,
}: {
  settings: DeveloperCreditSettings;
}) {
  if (!settings.enabled || !settings.name.trim()) return null;

  return (
    <footer className="border-t border-neutral-200/80 bg-white/70 px-4 pb-24 pt-5 text-center text-sm text-neutral-500 lg:pb-5">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <Code2 aria-hidden="true" className="size-4 text-teal-700" />
        <span>{settings.label}</span>
        {settings.url ? (
          <a
            href={settings.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-neutral-800 transition hover:text-teal-800"
          >
            {settings.name}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : (
          <span className="font-semibold text-neutral-800">{settings.name}</span>
        )}
      </div>
    </footer>
  );
}
