"use client";

import { useState } from "react";
import type { DeveloperCreditSettings as CreditSettings } from "@/components/developer-credit-footer";
import { apiFetch } from "@/lib/client-api";

export function DeveloperCreditSettings({
  initialSettings,
}: {
  initialSettings: CreditSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "developerCredit", value: settings }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to save developer credit.");
      setMessage("Developer credit settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save developer credit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-6 grid gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">Website footer</p>
        <h2 className="mt-1 text-lg font-bold text-neutral-950">Developer credit</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Add a small “Developed by” credit to the bottom of public and workspace pages.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
        <input
          checked={settings.enabled}
          onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))}
          type="checkbox"
          className="mt-0.5 size-4 rounded border-neutral-300"
        />
        <span>
          <span className="block font-semibold text-neutral-900">Show developer credit in website footer</span>
          <span className="mt-0.5 block text-neutral-500">Turn this off any time to hide the credit everywhere.</span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-neutral-800">
          Credit label
          <input
            value={settings.label}
            onChange={(event) => setSettings((current) => ({ ...current, label: event.target.value }))}
            maxLength={40}
            required
            placeholder="Developed by"
            className="rounded-lg border border-neutral-300 px-3 py-2.5"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-neutral-800">
          Developer or agency name
          <input
            value={settings.name}
            onChange={(event) => setSettings((current) => ({ ...current, name: event.target.value }))}
            maxLength={80}
            required={settings.enabled}
            placeholder="Your developer name"
            className="rounded-lg border border-neutral-300 px-3 py-2.5"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-neutral-800 sm:col-span-2">
          Link (optional)
          <input
            value={settings.url}
            onChange={(event) => setSettings((current) => ({ ...current, url: event.target.value }))}
            maxLength={2048}
            type="url"
            placeholder="https://example.com"
            className="rounded-lg border border-neutral-300 px-3 py-2.5"
          />
          <span className="text-xs font-normal text-neutral-500">
            When set, the developer name links to this website.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={loading}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save developer credit"}
        </button>
        {message && <p role="status" className="text-sm text-neutral-600">{message}</p>}
      </div>
    </form>
  );
}
