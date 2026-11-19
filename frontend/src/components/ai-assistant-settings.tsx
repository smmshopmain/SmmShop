"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client-api";

type ActionMode = "preview_confirm" | "admin_direct" | "direct_all";

export function AIAssistantSettings({
  initialEnabled,
  initialActionMode,
  keyConfigured,
}: {
  initialEnabled: boolean;
  initialActionMode: ActionMode;
  keyConfigured: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [actionMode, setActionMode] = useState<ActionMode>(initialActionMode);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "ai", value: { enabled, actionMode } }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Unable to save AI settings.");
      setMessage("AI settings saved.");
      window.dispatchEvent(new Event("ai-settings-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save AI settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface-card mb-6 rounded-2xl border border-neutral-200 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">AI operations</p>
          <h2 className="mt-1 text-lg font-bold text-neutral-950">AI assistant</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600">
            Give admins a controlled workspace assistant and let signed-in users search services, review their orders, and request support.
          </p>
        </div>
        <label className="inline-flex shrink-0 items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4 accent-teal-700"
          />
          Enable AI assistant
        </label>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
        <label className="block text-sm font-semibold text-neutral-800">
          AI action policy
          <select
            value={actionMode}
            onChange={(event) => setActionMode(event.target.value as ActionMode)}
            className="mt-2 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm font-medium"
          >
            <option value="preview_confirm">Preview first; require approval for every action</option>
            <option value="admin_direct">Admin actions run directly; user actions require approval</option>
            <option value="direct_all">Direct execution for admin and user actions</option>
          </select>
        </label>
        <div className="rounded-xl bg-neutral-50 px-4 py-3 text-xs leading-5 text-neutral-600">
          <p className="font-bold text-neutral-800">Velona API key</p>
          <p className="mt-1">
            {keyConfigured
              ? "Configured on the backend. The secret is never returned to the browser."
              : "Not configured. Add VELONA_API_KEY to the backend environment before enabling AI."}
          </p>
          <p className="mt-2">With AI disabled, assistant navigation, chat access, and AI actions are unavailable.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-900 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save AI settings"}
        </button>
        {message && <p role="status" className="text-sm text-neutral-600">{message}</p>}
      </div>
    </section>
  );
}
