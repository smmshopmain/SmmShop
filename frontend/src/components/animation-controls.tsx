"use client";

import { useState } from "react";
import { Activity, Check, Sparkles, Wind } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { AdminSection } from "@/components/admin-ui";
import {
  DEFAULT_MOTION_SETTINGS,
  type MotionSettings,
  useMotionSettings,
} from "@/components/motion-settings-provider";

function Toggle({
  checked,
  disabled,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-teal-200 ${disabled ? "opacity-50" : ""}`}>
      <span>
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 shrink-0 accent-teal-700"
      />
    </label>
  );
}

export function AnimationControls({ initialSettings }: { initialSettings: MotionSettings }) {
  const { setSettings: setGlobalSettings } = useMotionSettings();
  const [settings, setSettings] = useState<MotionSettings>({
    ...DEFAULT_MOTION_SETTINGS,
    ...initialSettings,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function update(patch: Partial<MotionSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setGlobalSettings(next);
    setMessage("");
    setError("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "appearance", value: settings }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Unable to save animation settings.");
      }
      setGlobalSettings(settings);
      setMessage("Website design and animation preferences saved and applied for all visitors.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save animation settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminSection
      title="Website design & animations"
      description="Choose the design that becomes the site-wide default, then tune its motion, colour, and speed."
      icon={Sparkles}
    >
      <form onSubmit={save} className="grid gap-5 p-4 sm:p-6">
        <div>
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900">Website design</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Preview a design here, then save to apply it for every visitor and logged-in panel.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              {
                id: "default",
                title: "Classic · Original",
                description: "Keep the existing light panel design.",
                swatches: ["#f4f7f7", "#ffffff", "#0f766e"],
              },
              {
                id: "studio",
                title: "Studio · Redesigned",
                description: "A fresh, polished workspace across user pages.",
                swatches: ["#eaf3f2", "#ffffff", "#0e7490"],
              },
              {
                id: "midnight",
                title: "Midnight Studio",
                description: "A premium dark workspace with blue-violet highlights.",
                swatches: ["#0b1020", "#172033", "#818cf8"],
              },
            ] as const).map((design) => {
              const selected = settings.designPreset === design.id;
              return (
                <button
                  key={design.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => update({ designPreset: design.id })}
                  className={`rounded-2xl border p-3 text-left transition ${
                    selected
                      ? "border-teal-600 bg-teal-50/70 ring-2 ring-teal-600/15"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="grid h-20 grid-cols-[1fr_2fr] gap-1 overflow-hidden rounded-xl border border-black/5 p-1" style={{ backgroundColor: design.swatches[0] }}>
                    <span className="rounded-md" style={{ backgroundColor: design.swatches[1] }} />
                    <span className="grid grid-rows-[1fr_1fr] gap-1">
                      <span className="rounded-md" style={{ backgroundColor: design.swatches[1] }} />
                      <span className="w-2/3 rounded-md" style={{ backgroundColor: design.swatches[2] }} />
                    </span>
                  </span>
                  <span className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{design.title}</span>
                    {selected && <Check className="size-4 text-teal-700" aria-label="Selected design" />}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{design.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Toggle
            checked={settings.animationsEnabled}
            onChange={(animationsEnabled) => update({ animationsEnabled })}
            label="Enable website animations"
            description="Master switch for every animated effect on the public site and dashboard."
          />
          <Toggle
            checked={settings.entranceEnabled}
            disabled={!settings.animationsEnabled}
            onChange={(entranceEnabled) => update({ entranceEnabled })}
            label="Page entrance"
            description="Soft fade and rise when a page or section appears."
          />
          <Toggle
            checked={settings.floatingEnabled}
            disabled={!settings.animationsEnabled}
            onChange={(floatingEnabled) => update({ floatingEnabled })}
            label="Ambient floating"
            description="Gentle floating and glow effects used in decorative elements."
          />
          <Toggle
            checked={settings.hoverEnabled}
            disabled={!settings.animationsEnabled}
            onChange={(hoverEnabled) => update({ hoverEnabled })}
            label="Interactive motion"
            description="Small transitions on buttons, cards, and navigation items."
          />
        </div>

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2 sm:p-5">
          <label className="grid gap-2 text-sm font-semibold text-slate-800">
            Animation accent colour
            <span className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
              <input
                type="color"
                value={settings.animationColor}
                disabled={!settings.animationsEnabled}
                onChange={(event) => update({ animationColor: event.target.value })}
                className="size-11 cursor-pointer rounded-lg border-0 bg-transparent p-1 disabled:cursor-not-allowed"
                aria-label="Animation accent colour"
              />
              <span className="font-mono text-xs font-medium uppercase text-slate-500">{settings.animationColor}</span>
              <span
                className="ml-auto size-7 rounded-full shadow-sm"
                style={{ backgroundColor: settings.animationColor }}
                aria-hidden="true"
              />
            </span>
          </label>

          <label className="grid content-start gap-2 text-sm font-semibold text-slate-800">
            Animation speed
            <span className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
              <span className="text-xs font-medium text-slate-500">Slow</span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.animationSpeed}
                disabled={!settings.animationsEnabled}
                onChange={(event) => update({ animationSpeed: Number(event.target.value) })}
                className="w-full accent-teal-700 disabled:cursor-not-allowed"
                aria-label="Animation speed"
              />
              <span className="min-w-12 text-right text-xs font-bold tabular-nums text-teal-800">
                {settings.animationSpeed.toFixed(1)}x
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl bg-slate-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <span
              className="grid size-11 place-items-center rounded-xl bg-white/10"
              style={{ color: settings.animationColor }}
            >
              <Activity
                className={settings.animationsEnabled ? "size-5 animate-pulse" : "size-5"}
                style={{ animationDuration: `${2800 / settings.animationSpeed}ms` }}
              />
            </span>
            <span>
              <span className="block text-sm font-semibold">Live preview</span>
              <span className="mt-1 block text-xs text-slate-400">
                {settings.animationsEnabled ? `${settings.animationSpeed.toFixed(1)}x speed · ${settings.animationColor}` : "Animations are currently off"}
              </span>
            </span>
            <span className="hidden items-center gap-2 text-xs text-slate-400 md:inline-flex">
              <Wind className="size-4" /> Preview reflects saved global effects
            </span>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-950/20 hover:bg-teal-500 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Apply & save appearance"}
            {!saving && <Check className="size-4" />}
          </button>
        </div>

        {message && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</p>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</p>}
      </form>
    </AdminSection>
  );
}
