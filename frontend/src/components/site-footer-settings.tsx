"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteFooterLink, SiteFooterSettings as FooterSettingsValue } from "@/components/developer-credit-footer";
import { apiFetch } from "@/lib/client-api";

export function SiteFooterSettings({
  initialSettings,
}: {
  initialSettings: FooterSettingsValue;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function update<K extends keyof FooterSettingsValue>(key: K, value: FooterSettingsValue[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function updateLink(group: "quickLinks" | "supportLinks", index: number, patch: Partial<SiteFooterLink>) {
    setSettings((current) => ({
      ...current,
      [group]: current[group].map((link, linkIndex) =>
        linkIndex === index ? { ...link, ...patch } : link,
      ),
    }));
  }

  function addLink(group: "quickLinks" | "supportLinks") {
    setSettings((current) => ({
      ...current,
      [group]: [...current[group], { label: "", href: "" }],
    }));
  }

  function removeLink(group: "quickLinks" | "supportLinks", index: number) {
    setSettings((current) => ({
      ...current,
      [group]: current[group].filter((_, linkIndex) => linkIndex !== index),
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "siteFooter", value: settings }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to save footer settings.");
      setMessage("Footer settings saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save footer settings.");
    } finally {
      setLoading(false);
    }
  }

  function linkEditor(title: string, group: "quickLinks" | "supportLinks") {
    return (
      <section className="grid content-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-neutral-900">{title} links</h3>
          <button
            type="button"
            disabled={settings[group].length >= 8}
            onClick={() => addLink(group)}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            <Plus className="size-3.5" /> Add link
          </button>
        </div>
        <div className="grid gap-3">
          {settings[group].map((link, index) => (
            <div key={`${group}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
              <input
                value={link.label}
                onChange={(event) => updateLink(group, index, { label: event.target.value })}
                maxLength={60}
                aria-label={`${title} link text ${index + 1}`}
                placeholder="Link text"
                className="min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
              <input
                value={link.href}
                onChange={(event) => updateLink(group, index, { href: event.target.value })}
                maxLength={2048}
                aria-label={`${title} link URL ${index + 1}`}
                placeholder="/page or https://example.com"
                className="min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeLink(group, index)}
                aria-label={`Remove ${title.toLowerCase()} link ${index + 1}`}
                className="grid size-9 place-items-center rounded-lg border border-neutral-300 bg-white text-neutral-500 hover:border-rose-200 hover:text-rose-700"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {settings[group].length === 0 && (
            <p className="text-xs text-neutral-500">No links added. This section will be hidden in the footer.</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="mb-6 grid gap-5 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">Website footer</p>
        <h2 className="mt-1 text-lg font-bold text-neutral-950">Footer content and links</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Edit every footer heading, link, brand detail, and contact field. The layout automatically matches the selected site theme.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
        <input
          checked={settings.enabled}
          onChange={(event) => update("enabled", event.target.checked)}
          type="checkbox"
          className="mt-0.5 size-4 rounded border-neutral-300"
        />
        <span>
          <span className="block font-semibold text-neutral-900">Show website footer</span>
          <span className="mt-0.5 block text-neutral-500">Hide or show the complete footer across the website.</span>
        </span>
      </label>

      <section className="grid gap-3 rounded-xl border border-neutral-200 p-4">
        <h3 className="text-sm font-semibold text-neutral-900">Brand information</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-neutral-800">
            Brand name
            <input value={settings.brandName} onChange={(event) => update("brandName", event.target.value)} maxLength={80} required className="rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-neutral-800">
            Tagline
            <input value={settings.tagline} onChange={(event) => update("tagline", event.target.value)} maxLength={160} className="rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-neutral-800 sm:col-span-2">
            Short description
            <textarea value={settings.description} onChange={(event) => update("description", event.target.value)} maxLength={500} rows={3} className="rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid content-start gap-3 rounded-xl border border-neutral-200 p-4">
          <h3 className="text-sm font-semibold text-neutral-900">Quick links section</h3>
          <label className="grid gap-1.5 text-sm font-medium text-neutral-800">
            Section heading
            <input value={settings.quickLinksTitle} onChange={(event) => update("quickLinksTitle", event.target.value)} maxLength={40} required className="rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
          {linkEditor("Quick", "quickLinks")}
        </section>
        <section className="grid content-start gap-3 rounded-xl border border-neutral-200 p-4">
          <h3 className="text-sm font-semibold text-neutral-900">Support links section</h3>
          <label className="grid gap-1.5 text-sm font-medium text-neutral-800">
            Section heading
            <input value={settings.supportLinksTitle} onChange={(event) => update("supportLinksTitle", event.target.value)} maxLength={40} required className="rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
          {linkEditor("Support", "supportLinks")}
        </section>
      </div>

      <section className="grid gap-3 rounded-xl border border-neutral-200 p-4">
        <h3 className="text-sm font-semibold text-neutral-900">Contact and business details</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-neutral-800">
            Section heading
            <input value={settings.contactTitle} onChange={(event) => update("contactTitle", event.target.value)} maxLength={40} required className="rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-neutral-800">
            Contact email
            <input type="email" value={settings.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} maxLength={254} placeholder="support@example.com" className="rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-neutral-800">
            Phone
            <input type="tel" value={settings.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} maxLength={40} placeholder="+91 ..." className="rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-neutral-800">
            WhatsApp URL
            <input type="url" value={settings.whatsappUrl} onChange={(event) => update("whatsappUrl", event.target.value)} maxLength={2048} placeholder="https://wa.me/..." className="rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-neutral-800 sm:col-span-2">
            Address or other contact details
            <textarea value={settings.address} onChange={(event) => update("address", event.target.value)} maxLength={250} rows={2} className="rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-neutral-800">
            Business hours
            <input value={settings.businessHours} onChange={(event) => update("businessHours", event.target.value)} maxLength={120} placeholder="Mon–Fri, 9:00 AM–6:00 PM" className="rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-neutral-800">
            Copyright text
            <input value={settings.copyrightText} onChange={(event) => update("copyrightText", event.target.value)} maxLength={120} placeholder="All rights reserved." className="rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={loading} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
          {loading ? "Saving..." : "Save footer settings"}
        </button>
        {message && <p role="status" className="text-sm text-neutral-600">{message}</p>}
      </div>
    </form>
  );
}
