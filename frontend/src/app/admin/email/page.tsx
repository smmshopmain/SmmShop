"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AdminHeader, AdminSection } from "@/components/admin-ui";
import { GoogleAuthSettings } from "@/components/google-auth-settings";
import { apiFetch, apiJson } from "@/lib/client-api";

type Template = { subject: string; body: string };
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
  const [campaignForm, setCampaignForm] = useState({
    title: "",
    kind: "announcement" as Campaign["kind"],
    subject: "",
    body: "",
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

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!window.confirm("Confirm this email campaign? It will be sent to the selected audience at the chosen time.")) return;
    setSaving(true);
    try {
      const response = await apiFetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...campaignForm,
          sendNow: campaignForm.sendMode === "now",
          scheduledAt: campaignForm.sendMode === "now"
            ? new Date().toISOString()
            : new Date(campaignForm.scheduledAt).toISOString(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to schedule campaign.");
      setMessage(campaignForm.sendMode === "now" ? "Campaign created. Starting delivery now…" : "Campaign confirmed and scheduled.");
      setCampaignForm((current) => ({ ...current, title: "", subject: "", body: "" }));
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
              <button disabled={saving} className="w-fit rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving…" : "Save email templates"}</button>
            </form>
          </AdminSection>

          <AdminSection title="Create announcement or advertisement" description="Preview the subject and message, confirm the audience, and send now or schedule for later.">
            <form onSubmit={createCampaign} className="grid gap-4 p-4 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Internal campaign name" value={campaignForm.title} onChange={(value) => setCampaignForm({ ...campaignForm, title: value })} />
                <label className="text-sm font-semibold text-neutral-800">Campaign type<select className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" value={campaignForm.kind} onChange={(event) => setCampaignForm({ ...campaignForm, kind: event.target.value as Campaign["kind"] })}><option value="announcement">Announcement</option><option value="advertisement">Advertisement</option></select></label>
              </div>
              <Field label="Email subject" value={campaignForm.subject} onChange={(value) => setCampaignForm({ ...campaignForm, subject: value })} />
              <Field label="Email message (plain text)" multiline value={campaignForm.body} onChange={(value) => setCampaignForm({ ...campaignForm, body: value })} />
              <label className="block text-sm font-semibold text-neutral-800">Delivery timing<select className="mt-1 block w-full max-w-sm rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" value={campaignForm.sendMode} onChange={(event) => setCampaignForm({ ...campaignForm, sendMode: event.target.value as "now" | "scheduled" })}><option value="now">Send now</option><option value="scheduled">Schedule for later</option></select></label>
              {campaignForm.sendMode === "scheduled" && (
                <label className="block text-sm font-semibold text-neutral-800">Send at<input type="datetime-local" required className="mt-1 block rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" value={campaignForm.scheduledAt} onChange={(event) => setCampaignForm({ ...campaignForm, scheduledAt: event.target.value })} /></label>
              )}
              <label className="flex items-start gap-3 text-sm text-neutral-700"><input type="checkbox" className="mt-1 size-4" checked={campaignForm.includeUnsubscribed} onChange={(event) => setCampaignForm({ ...campaignForm, includeUnsubscribed: event.target.checked })} /><span>Include users who opted out of marketing emails (use only for appropriate, non-promotional service communications).</span></label>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Preview</p>
                <h3 className="mt-2 font-bold text-neutral-900">{campaignForm.subject || "Email subject preview"}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{campaignForm.body || "Your message preview will appear here."}</p>
              </div>
              <button disabled={saving} className="w-fit rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? (campaignForm.sendMode === "now" ? "Starting…" : "Scheduling…") : (campaignForm.sendMode === "now" ? "Confirm and send now" : "Confirm and schedule campaign")}</button>
            </form>
          </AdminSection>

          <AdminSection title="Recent email campaigns" description="Delivery runs in resumable batches; queued campaigns continue on later cron calls.">
            {campaigns.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-neutral-500"><tr><th className="p-3">Campaign</th><th className="p-3">Status</th><th className="p-3">Scheduled</th><th className="p-3">Recipients</th><th className="p-3">Sent / failed</th><th className="p-3">Unsubscribed included</th><th className="p-3">Delivery details</th></tr></thead>
                  <tbody>{campaigns.map((campaign) => <tr key={campaign._id} className="border-t border-neutral-100"><td className="p-3"><span className="font-semibold">{campaign.title}</span><span className="block text-xs text-neutral-500">{campaign.kind}: {campaign.subject}</span></td><td className="p-3 capitalize">{campaign.status}</td><td className="p-3 whitespace-nowrap">{new Date(campaign.scheduledAt).toLocaleString()}</td><td className="p-3">{campaign.recipientCount}</td><td className="p-3">{campaign.sentCount} / {campaign.failedCount}</td><td className="p-3">{campaign.includeUnsubscribed ? "Yes" : "No"}</td><td className="max-w-xs p-3 text-xs text-rose-700">{campaign.lastError || "—"}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="p-5 text-sm text-neutral-500">No campaigns created yet.</p>}
          </AdminSection>
        </div>
      )}
    </AppShell>
  );
}
