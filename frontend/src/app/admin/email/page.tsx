"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AdminHeader, AdminSection } from "@/components/admin-ui";
import { GoogleAuthSettings } from "@/components/google-auth-settings";
import { apiFetch, apiJson } from "@/lib/client-api";
import { Search, Sparkles, X } from "lucide-react";

type Template = { subject: string; body: string };
type CampaignService = {
  serviceId: string;
  name: string;
  category: string;
  platform: string;
  sellingRate: number;
  type: string;
  min: number;
  max: number;
};
type EmailSettings = {
  brandName: string;
  primaryColor: string;
  accentColor: string;
  templates: {
    registrationOtp: Template;
    forgotPasswordOtp: Template;
    verificationOtp: Template;
    welcome: Template & { headline: string };
  };
};
type Campaign = {
  _id: string;
  title: string;
  kind: "announcement" | "advertisement";
  subject: string;
  greeting: string;
  body: string;
  services: CampaignService[];
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  includeUnsubscribed: boolean;
  scheduledAt: string;
  lastError?: string;
};
type SettingsResponse = {
  email?: EmailSettings;
  auth?: { googleEnabled: boolean; googleConfigured: boolean };
};

const DEFAULT_EMAIL: EmailSettings = {
  brandName: "SMM Panel",
  primaryColor: "#0b3038",
  accentColor: "#087e78",
  templates: {
    registrationOtp: {
      subject: "Verify your SMM Panel email",
      body: "Enter this OTP to finish creating your account.\nMobile number entered for registration: {{phone}}\nThis OTP expires in {{expiryMinutes}} minutes. If you did not create an account, ignore this email.",
    },
    forgotPasswordOtp: {
      subject: "SMM Panel password reset OTP",
      body: "Your password reset OTP is below. It expires in {{expiryMinutes}} minutes. If you did not request this, ignore this email.",
    },
    verificationOtp: {
      subject: "SMM Panel verification code",
      body: "Your account verification OTP is below. It expires in {{expiryMinutes}} minutes. If you did not request this, ignore this email.",
    },
    welcome: {
      subject: "Welcome to SMM Panel — your growth workspace is ready",
      headline: "Welcome aboard, {{name}}!",
      body: "Your account is ready. Explore social growth services, manage your wallet, track orders, and get support from one workspace.",
    },
  },
};

function localDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const className = "mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900";
  return (
    <label className="block text-sm font-semibold text-neutral-800">
      {label}
      {multiline ? (
        <textarea className={`${className} min-h-28`} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={className} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

export default function EmailManagementPage() {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [google, setGoogle] = useState({ googleEnabled: false, googleConfigured: false });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [serviceResults, setServiceResults] = useState<CampaignService[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceLoading, setServiceLoading] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    title: "",
    kind: "announcement" as Campaign["kind"],
    subject: "",
    greeting: "Hello {{name}},",
    body: "",
    services: [],
    includeUnsubscribed: false,
    sendMode: "now" as "now" | "scheduled",
    scheduledAt: localDateTimeValue(new Date()),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiJson("/api/admin/settings") as Promise<SettingsResponse>,
      apiJson("/api/admin/email-campaigns"),
    ])
      .then(([settings, campaignData]) => {
        if (!settings.email) throw new Error("Email settings are missing from the server response.");
        if (!active) return;
        setEmail(settings.email);
        setGoogle(settings.auth ?? { googleEnabled: false, googleConfigured: false });
        setCampaigns(campaignData.campaigns ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load email management.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateTemplate<K extends keyof EmailSettings["templates"]>(
    key: K,
    field: keyof EmailSettings["templates"][K],
    value: string,
  ) {
    setEmail((current) => ({
      ...current,
      templates: {
        ...current.templates,
        [key]: { ...current.templates[key], [field]: value },
      },
    }));
  }

  async function saveTemplates(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "email", value: email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to save email templates.");
      setMessage("Email branding and templates saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save email templates.");
    } finally {
      setSaving(false);
    }
  }

  async function restoreEmailDefaults() {
    if (!window.confirm("Restore the default email brand colors and all email templates? This will overwrite your current customizations.")) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");
    try {
      const defaults: EmailSettings = {
        ...DEFAULT_EMAIL,
        templates: {
          registrationOtp: { ...DEFAULT_EMAIL.templates.registrationOtp },
          forgotPasswordOtp: { ...DEFAULT_EMAIL.templates.forgotPasswordOtp },
          verificationOtp: { ...DEFAULT_EMAIL.templates.verificationOtp },
          welcome: { ...DEFAULT_EMAIL.templates.welcome },
        },
      };
      const response = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "email", value: defaults }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to restore default email settings.");
      setEmail(defaults);
      setMessage("Default email colors and templates restored and saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to restore default email settings.");
    } finally {
      setSaving(false);
    }
  }

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!window.confirm("Confirm this email campaign? It will be sent to the selected audience at the chosen time.")) return;
    setSaving(true);
    try {
      const { services, ...campaignPayload } = campaignForm;
      const response = await apiFetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...campaignPayload,
          serviceIds: services.map((service) => service.serviceId),
          sendNow: campaignForm.sendMode === "now",
          scheduledAt: campaignForm.sendMode === "now"
            ? new Date().toISOString()
            : new Date(campaignForm.scheduledAt).toISOString(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to schedule campaign.");
      setMessage(campaignForm.sendMode === "now" ? "Campaign created. Starting delivery now…" : "Campaign confirmed and scheduled.");
      setCampaignForm((current) => ({ ...current, title: "", subject: "", greeting: "Hello {{name}},", body: "", services: [] }));
      if (campaignForm.sendMode === "now") {
        let continueSending = true;
        let sent = 0;
        let failed = 0;
        while (continueSending) {
          const startResponse = await apiFetch("/api/cron/email-campaigns", { method: "POST" });
          const startResult = await startResponse.json();
          if (!startResponse.ok) {
            throw new Error(`Campaign was saved, but immediate delivery stopped: ${startResult.message ?? "Please check the campaign status and cron configuration."}`);
          }
          const batch = startResult.data;
          if (!batch?.processed) {
            setMessage("Campaign is queued. Delivery will continue automatically in the background.");
            break;
          }
          sent += Number(batch.sent ?? 0);
          failed += Number(batch.failed ?? 0);
          continueSending = batch.hasMore === true;
          setMessage(
            continueSending
              ? `Sending campaign… ${sent + failed} of ${result.campaign?.recipientCount ?? "all"} processed.`
              : `Campaign delivery finished. ${sent} sent${failed ? `, ${failed} failed` : ""}.`,
          );
        }
      }
      const campaignData = await apiJson("/api/admin/email-campaigns");
      setCampaigns(campaignData.campaigns ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to schedule campaign.");
    } finally {
      setSaving(false);
    }
  }

  async function loadLatestServices(count: 5 | 10) {
    setServiceLoading(true);
    setError("");
    try {
      const result = await apiJson(`/api/admin/email-campaign-services?limit=${count}`);
      const services = (result.services ?? []) as CampaignService[];
      setCampaignForm((current) => ({ ...current, services }));
      setServiceResults([]);
      setServiceSearch("");
      const missingPlatforms = [
        result.includedInstagram ? "" : "Instagram",
        result.includedYouTube ? "" : "YouTube",
      ].filter(Boolean);
      setMessage(
        services.length
          ? `Loaded ${services.length} latest services${missingPlatforms.length ? `. No active ${missingPlatforms.join(" or ")} service was available to include` : ", including Instagram and YouTube"}.`
          : "No active services are available to add.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load latest services.");
    } finally {
      setServiceLoading(false);
    }
  }

  async function searchCampaignServices() {
    if (!serviceSearch.trim()) {
      setError("Enter a service name or category to search.");
      return;
    }
    setServiceLoading(true);
    setError("");
    try {
      const result = await apiJson(`/api/admin/email-campaign-services?q=${encodeURIComponent(serviceSearch.trim())}`);
      setServiceResults((result.services ?? []) as CampaignService[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to search services.");
    } finally {
      setServiceLoading(false);
    }
  }

  function addCampaignService(service: CampaignService) {
    setCampaignForm((current) => {
      if (current.services.some((item) => item.serviceId === service.serviceId)) return current;
      if (current.services.length >= 10) {
        setError("A campaign can include up to 10 services.");
        return current;
      }
      setError("");
      return { ...current, services: [...current.services, service] };
    });
  }

  function removeCampaignService(serviceId: string) {
    setCampaignForm((current) => ({
      ...current,
      services: current.services.filter((service) => service.serviceId !== serviceId),
    }));
  }

  function duplicateCampaign(campaign: Campaign) {
    setCampaignForm({
      title: `${campaign.title} (copy)`.slice(0, 120),
      kind: campaign.kind,
      subject: campaign.subject,
      greeting: campaign.greeting || "Hello {{name}},",
      body: campaign.body,
      services: campaign.services ?? [],
      includeUnsubscribed: campaign.includeUnsubscribed,
      sendMode: "now",
      scheduledAt: localDateTimeValue(new Date()),
    });
    setError("");
    setMessage(`“${campaign.title}” loaded as a draft. Edit it and confirm when ready.`);
    document.getElementById("campaign-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Communications"
        title="Email Management"
        description="Control Google sign-in, branded account emails, one-time-code messages, and scheduled announcements or promotions."
      />
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
      {loading ? (
        <p className="surface-card p-6 text-sm text-neutral-600">Loading email settings…</p>
      ) : (
        <div className="grid gap-6">
          <GoogleAuthSettings enabled={google.googleEnabled} configured={google.googleConfigured} />

          <AdminSection title="Email branding and transactional templates" description="OTP values and expiry notices remain present even when you customize the explanatory copy.">
            <form onSubmit={saveTemplates} className="grid gap-6 p-4 sm:p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Brand name" value={email.brandName} onChange={(value) => setEmail({ ...email, brandName: value })} />
                <label className="text-sm font-semibold text-neutral-800">Primary color<input aria-label="Primary color" type="color" className="mt-1 block h-10 w-full rounded-lg" value={email.primaryColor} onChange={(event) => setEmail({ ...email, primaryColor: event.target.value })} /></label>
                <label className="text-sm font-semibold text-neutral-800">Accent color<input aria-label="Accent color" type="color" className="mt-1 block h-10 w-full rounded-lg" value={email.accentColor} onChange={(event) => setEmail({ ...email, accentColor: event.target.value })} /></label>
              </div>

              {([
                ["registrationOtp", "Registration OTP", "{{phone}}, {{otp}}, {{expiryMinutes}}"],
                ["forgotPasswordOtp", "Forgot-password OTP", "{{otp}}, {{expiryMinutes}}"],
                ["verificationOtp", "Account/security verification OTP", "{{purpose}}, {{otp}}, {{expiryMinutes}}"],
              ] as const).map(([key, title, help]) => (
                <div key={key} className="grid gap-3 border-t border-neutral-200 pt-5">
                  <h3 className="font-bold text-neutral-900">{title}</h3>
                  <Field label="Subject" value={email.templates[key].subject} onChange={(value) => updateTemplate(key, "subject", value)} />
                  <Field label="Message" multiline value={email.templates[key].body} onChange={(value) => updateTemplate(key, "body", value)} />
                  <p className="text-xs text-neutral-500">Available placeholders: {help}</p>
                </div>
              ))}

              <div className="grid gap-3 border-t border-neutral-200 pt-5">
                <h3 className="font-bold text-neutral-900">Welcome email</h3>
                <Field label="Subject" value={email.templates.welcome.subject} onChange={(value) => updateTemplate("welcome", "subject", value)} />
                <Field label="Headline" value={email.templates.welcome.headline} onChange={(value) => updateTemplate("welcome", "headline", value)} />
                <Field label="Message" multiline value={email.templates.welcome.body} onChange={(value) => updateTemplate("welcome", "body", value)} />
                <p className="text-xs text-neutral-500">Available placeholders: {"{{name}}, {{email}}, {{phone}}, {{websiteUrl}}"}. Passwords are never included in email.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={saving} className="w-fit rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving…" : "Save email templates"}</button>
                <button type="button" onClick={() => void restoreEmailDefaults()} disabled={saving} className="w-fit rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-60">{saving ? "Please wait…" : "Restore default email settings"}</button>
              </div>
            </form>
          </AdminSection>

          <AdminSection title="Create announcement or advertisement" description="Personalize the greeting, preview the message, and confirm the audience before sending or scheduling.">
            <form id="campaign-composer" onSubmit={createCampaign} className="grid gap-4 p-4 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Internal campaign name" value={campaignForm.title} onChange={(value) => setCampaignForm({ ...campaignForm, title: value })} />
                <label className="text-sm font-semibold text-neutral-800">Campaign type<select className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" value={campaignForm.kind} onChange={(event) => setCampaignForm({ ...campaignForm, kind: event.target.value as Campaign["kind"] })}><option value="announcement">Announcement</option><option value="advertisement">Advertisement</option></select></label>
              </div>
              <Field label="Email subject" value={campaignForm.subject} onChange={(value) => setCampaignForm({ ...campaignForm, subject: value })} />
              <Field label="Personalized greeting" value={campaignForm.greeting} onChange={(value) => setCampaignForm({ ...campaignForm, greeting: value })} />
              <p className="-mt-2 text-xs text-neutral-500">Available placeholders: {"{{name}}, {{email}}, {{brandName}}"} — recipient name and email are read from their account.</p>
              <Field label="Email message (plain text)" multiline value={campaignForm.body} onChange={(value) => setCampaignForm({ ...campaignForm, body: value })} />
              <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5" aria-labelledby="campaign-services-heading">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 id="campaign-services-heading" className="font-bold text-neutral-900">Featured services <span className="font-medium text-neutral-500">({campaignForm.services.length}/10)</span></h3>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">Include selected services in a polished email section. Latest picks prioritize Instagram and YouTube when active services are available.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={serviceLoading} onClick={() => void loadLatestServices(5)} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800 transition hover:bg-teal-50 disabled:opacity-50">
                      <Sparkles className="size-3.5" /> Latest 5
                    </button>
                    <button type="button" disabled={serviceLoading} onClick={() => void loadLatestServices(10)} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800 transition hover:bg-teal-50 disabled:opacity-50">
                      <Sparkles className="size-3.5" /> Latest 10
                    </button>
                  </div>
                </div>

                {campaignForm.services.length > 0 ? (
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {campaignForm.services.map((service) => (
                      <li key={service.serviceId} className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                        <div className="min-w-0">
                          <span className="inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">{service.platform}</span>
                          <p className="mt-1 truncate text-sm font-bold text-neutral-900">{service.name}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">{service.category} · Rs.{Number(service.sellingRate).toFixed(2)} / 1k</p>
                        </div>
                        <button type="button" onClick={() => removeCampaignService(service.serviceId)} aria-label={`Remove ${service.name}`} className="grid size-8 shrink-0 place-items-center rounded-lg text-neutral-500 transition hover:bg-rose-50 hover:text-rose-700">
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed border-neutral-300 px-4 py-5 text-center text-sm text-neutral-500">No featured services selected. Load the latest services or search the catalog to add them.</p>
                )}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchCampaignServices(); } }} placeholder="Search any active service by name or category" className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900" />
                  <button type="button" disabled={serviceLoading} onClick={() => void searchCampaignServices()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                    <Search className="size-4" /> Search catalog
                  </button>
                </div>
                {serviceLoading && <p role="status" className="mt-3 text-xs text-neutral-500">Loading catalog services…</p>}
                {serviceResults.length > 0 && (
                  <ul className="mt-3 max-h-72 divide-y divide-neutral-100 overflow-y-auto rounded-xl border border-neutral-200">
                    {serviceResults.map((service) => {
                      const selected = campaignForm.services.some((item) => item.serviceId === service.serviceId);
                      return (
                        <li key={service.serviceId} className="flex items-center justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-teal-800">{service.platform}</span>
                            <p className="truncate text-sm font-semibold text-neutral-900">{service.name}</p>
                            <p className="text-xs text-neutral-500">{service.category} · Rs.{Number(service.sellingRate).toFixed(2)} / 1k</p>
                          </div>
                          <button type="button" disabled={selected || campaignForm.services.length >= 10} onClick={() => addCampaignService(service)} className="shrink-0 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
                            {selected ? "Added" : "Add"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              <label className="block text-sm font-semibold text-neutral-800">Delivery timing<select className="mt-1 block w-full max-w-sm rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" value={campaignForm.sendMode} onChange={(event) => setCampaignForm({ ...campaignForm, sendMode: event.target.value as "now" | "scheduled" })}><option value="now">Send now</option><option value="scheduled">Schedule for later</option></select></label>
              {campaignForm.sendMode === "scheduled" && (
                <label className="block text-sm font-semibold text-neutral-800">Send at<input type="datetime-local" required className="mt-1 block rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" value={campaignForm.scheduledAt} onChange={(event) => setCampaignForm({ ...campaignForm, scheduledAt: event.target.value })} /></label>
              )}
              <label className="flex items-start gap-3 text-sm text-neutral-700"><input type="checkbox" className="mt-1 size-4" checked={campaignForm.includeUnsubscribed} onChange={(event) => setCampaignForm({ ...campaignForm, includeUnsubscribed: event.target.checked })} /><span>Include users who opted out of marketing emails (use only for appropriate, non-promotional service communications).</span></label>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Preview</p>
                <h3 className="mt-2 font-bold text-neutral-900">{campaignForm.subject || "Email subject preview"}</h3>
                <p className="mt-3 text-sm font-semibold text-neutral-800">{campaignForm.greeting.replaceAll("{{name}}", "Alex Morgan").replaceAll("{{email}}", "alex@example.com").replaceAll("{{brandName}}", email.brandName) || "Greeting preview"}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{campaignForm.body.replaceAll("{{name}}", "Alex Morgan").replaceAll("{{email}}", "alex@example.com").replaceAll("{{brandName}}", email.brandName) || "Your message preview will appear here."}</p>
                {campaignForm.services.length > 0 && (
                  <div className="mt-4 grid gap-2 border-t border-neutral-200 pt-4 sm:grid-cols-2">
                    {campaignForm.services.map((service) => (
                      <div key={service.serviceId} className="rounded-xl border border-neutral-200 bg-white p-3">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-teal-800">{service.platform}</span>
                        <p className="mt-1 text-sm font-bold text-neutral-900">{service.name}</p>
                        <p className="mt-1 text-xs text-neutral-500">{service.category} · Rs.{Number(service.sellingRate).toFixed(2)} / 1k</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button disabled={saving} className="w-fit rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? (campaignForm.sendMode === "now" ? "Starting…" : "Scheduling…") : (campaignForm.sendMode === "now" ? "Confirm and send now" : "Confirm and schedule campaign")}</button>
            </form>
          </AdminSection>

          <AdminSection title="Recent email campaigns" description="Duplicate any campaign to reuse its content as an editable draft. Delivery runs in resumable batches.">
            {campaigns.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-neutral-500"><tr><th className="p-3">Campaign</th><th className="p-3">Status</th><th className="p-3">Scheduled</th><th className="p-3">Recipients</th><th className="p-3">Sent / failed</th><th className="p-3">Unsubscribed included</th><th className="p-3">Delivery details</th><th className="p-3">Actions</th></tr></thead>
                  <tbody>{campaigns.map((campaign) => <tr key={campaign._id} className="border-t border-neutral-100"><td className="p-3"><span className="font-semibold">{campaign.title}</span><span className="block text-xs text-neutral-500">{campaign.kind}: {campaign.subject}</span></td><td className="p-3 capitalize">{campaign.status}</td><td className="p-3 whitespace-nowrap">{new Date(campaign.scheduledAt).toLocaleString()}</td><td className="p-3">{campaign.recipientCount}</td><td className="p-3">{campaign.sentCount} / {campaign.failedCount}</td><td className="p-3">{campaign.includeUnsubscribed ? "Yes" : "No"}</td><td className="max-w-xs p-3 text-xs text-rose-700">{campaign.lastError || "—"}</td><td className="p-3"><button type="button" onClick={() => duplicateCampaign(campaign)} className="whitespace-nowrap rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800 transition hover:bg-teal-50">Duplicate &amp; edit</button></td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="p-5 text-sm text-neutral-500">No campaigns created yet.</p>}
          </AdminSection>
        </div>
      )}
    </AppShell>
  );
}
