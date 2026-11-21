"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client-api";

type ApiSettings = {
  enabled: boolean;
  standardEnabled: boolean;
  restEnabled: boolean;
  maxKeysPerUser: number;
  requestsPerMinute: number;
  discountEnabled: boolean;
  discountPercent: number;
  allowUserDiscountOverrides: boolean;
  manualSyncEnabled: boolean;
  autoSyncEnabled: boolean;
  minimumSyncIntervalMinutes: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  enforceIpAllowlist: boolean;
  providerTimeoutMs: number;
  requireVersionHeader: boolean;
};

export function ApiManagementSettings({ initialSettings }: { initialSettings: ApiSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function update<K extends keyof ApiSettings>(key: K, value: ApiSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "api", value: settings }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Unable to save API settings.");
      setMessage("API settings saved.");
      window.dispatchEvent(new Event("api-settings-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save API settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface-card mb-6 rounded-2xl border border-neutral-200 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Reseller API</p>
          <h2 className="mt-1 text-lg font-bold text-neutral-950">Global API controls</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600">
            When disabled, reseller API access and its user/admin sections are hidden and API requests are rejected. Your website orders and provider connection remain available.
          </p>
        </div>
        <label className="inline-flex shrink-0 items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => update("enabled", event.target.checked)}
            className="size-4 accent-teal-700"
          />
          Enable reseller API
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
          <input type="checkbox" checked={settings.maintenanceMode} onChange={(event) => update("maintenanceMode", event.target.checked)} className="size-4 accent-teal-700" />
          Put API into maintenance mode
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
          <input type="checkbox" checked={settings.enforceIpAllowlist} onChange={(event) => update("enforceIpAllowlist", event.target.checked)} className="size-4 accent-teal-700" />
          Enforce per-user IP allowlists
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
          <input type="checkbox" checked={settings.requireVersionHeader} onChange={(event) => update("requireVersionHeader", event.target.checked)} className="size-4 accent-teal-700" />
          Require REST version header
        </label>
        <label className="block text-sm font-semibold text-neutral-800 md:col-span-2">
          Maintenance response message
          <input type="text" maxLength={300} value={settings.maintenanceMessage} onChange={(event) => update("maintenanceMessage", event.target.value)} className="mt-2 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm" />
        </label>
        <p className="text-xs leading-5 text-neutral-500 md:col-span-2">
          When IP enforcement is enabled, every API user needs an exact IPv4 or IPv6 address saved in API Management. Ensure your deployment proxy supplies a trusted client IP header before enabling this.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
          <input type="checkbox" checked={settings.standardEnabled} onChange={(event) => update("standardEnabled", event.target.checked)} className="size-4 accent-teal-700" />
          Standard SMM API
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
          <input type="checkbox" checked={settings.restEnabled} onChange={(event) => update("restEnabled", event.target.checked)} className="size-4 accent-teal-700" />
          Versioned REST API
        </label>
        <label className="block text-sm font-semibold text-neutral-800">
          Maximum keys per user
          <input type="number" min={1} max={20} value={settings.maxKeysPerUser} onChange={(event) => update("maxKeysPerUser", Number(event.target.value))} className="mt-2 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm" />
        </label>
        <label className="block text-sm font-semibold text-neutral-800">
          Requests per key / minute
          <input type="number" min={1} max={10000} value={settings.requestsPerMinute} onChange={(event) => update("requestsPerMinute", Number(event.target.value))} className="mt-2 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm" />
        </label>
        <label className="block text-sm font-semibold text-neutral-800">
          Provider request timeout (milliseconds)
          <input type="number" min={1000} max={60000} step={1000} value={settings.providerTimeoutMs} onChange={(event) => update("providerTimeoutMs", Number(event.target.value))} className="mt-2 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
          <input type="checkbox" checked={settings.discountEnabled} onChange={(event) => update("discountEnabled", event.target.checked)} className="size-4 accent-teal-700" />
          Enable API-only reseller discount
        </label>
        <label className="block text-sm font-semibold text-neutral-800">
          Global discount (%)
          <input type="number" min={0} max={100} step="0.01" value={settings.discountPercent} onChange={(event) => update("discountPercent", Number(event.target.value))} className="mt-2 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
          <input type="checkbox" checked={settings.allowUserDiscountOverrides} onChange={(event) => update("allowUserDiscountOverrides", event.target.checked)} className="size-4 accent-teal-700" />
          Allow individual user discount overrides
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
          <input type="checkbox" checked={settings.manualSyncEnabled} onChange={(event) => update("manualSyncEnabled", event.target.checked)} className="size-4 accent-teal-700" />
          Allow manual service catalog sync
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
          <input type="checkbox" checked={settings.autoSyncEnabled} onChange={(event) => update("autoSyncEnabled", event.target.checked)} className="size-4 accent-teal-700" />
          Allow scheduled API service sync
        </label>
        <label className="block text-sm font-semibold text-neutral-800">
          Minimum automatic sync interval (minutes)
          <input type="number" min={5} max={10080} value={settings.minimumSyncIntervalMinutes} onChange={(event) => update("minimumSyncIntervalMinutes", Number(event.target.value))} className="mt-2 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm" />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-900 disabled:opacity-60">
          {saving ? "Saving..." : "Save API settings"}
        </button>
        {message && <p role="status" className="text-sm text-neutral-600">{message}</p>}
      </div>
    </section>
  );
}
