"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/client-api";

type CatalogSyncSettings = {
  dailyRefreshEnabled: boolean;
  dailyRefreshTime: string;
};

const DEFAULT_SETTINGS: CatalogSyncSettings = {
  dailyRefreshEnabled: true,
  dailyRefreshTime: "00:00",
};

export function CatalogRefreshScheduleSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    apiJson("/api/admin/settings")
      .then((result) => {
        if (!active) return;
        if (!result?.catalogSync) throw new Error(result?.message ?? "Unable to load daily refresh settings.");
        setSettings({ ...DEFAULT_SETTINGS, ...result.catalogSync });
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(true);
          setMessage(error instanceof Error ? error.message : "Unable to load daily refresh settings.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const result = await apiJson("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ key: "catalogSync", value: settings }),
      });
      if (!result?.ok) throw new Error(result?.message ?? "Unable to save daily refresh settings.");
      setMessage("Daily catalog schedule saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save daily refresh settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-neutral-950">Daily catalog refresh</h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-neutral-600">
            Automatically import services, sync the catalog, and recalculate prices every day. Time is India Standard Time (IST); it starts within 5 minutes of the selected time.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-800">
          <input
            type="checkbox"
            checked={settings.dailyRefreshEnabled}
            disabled={loading || saving || loadError}
            onChange={(event) => setSettings((current) => ({ ...current, dailyRefreshEnabled: event.target.checked }))}
            className="size-4 accent-teal-700"
          />
          Enable daily refresh
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm font-semibold text-neutral-800">
          Daily start time (IST)
          <input
            type="time"
            required
            value={settings.dailyRefreshTime}
            disabled={loading || saving || loadError}
            onChange={(event) => setSettings((current) => ({ ...current, dailyRefreshTime: event.target.value }))}
            className="mt-1.5 block rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={loading || saving || loadError}
          className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save schedule"}
        </button>
        {message && <p role="status" className="text-sm text-neutral-600">{message}</p>}
      </div>
    </section>
  );
}
