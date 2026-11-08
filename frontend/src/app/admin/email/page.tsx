"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AdminHeader, AdminSection } from "@/components/admin-ui";
import { GoogleAuthSettings } from "@/components/google-auth-settings";
import { apiFetch, apiJson, apiUrl } from "@/lib/client-api";
import { CAMPAIGN_BANNER_PRESETS, type CampaignBanner } from "@/lib/campaign-banners";
import { ImagePlus, Search, Sparkles, X } from "lucide-react";

type Template = { subject: string; body: string };
type CampaignRecipient = { _id: string; name: string; email: string };
type CampaignService = {
  serviceId: string;
  name: string;
  category: string;
  platform: string;
  country?: string;
  sellingRate: number;
  type: string;
  min: number;
  max: number;
};
const SERVICE_COUNTRIES = [
  "Worldwide", "India", "United States", "United Kingdom", "Canada", "Australia",
  "Brazil", "Indonesia", "Japan", "South Korea", "Philippines", "Vietnam",
  "Thailand", "Mexico", "Germany", "France", "Spain", "Italy", "Turkey",
  "Saudi Arabia", "United Arab Emirates", "Nigeria", "South Africa",
  "Bangladesh", "Pakistan",
];
const MAX_CAMPAIGN_IMAGE_SIZE = 10 * 1024 * 1024;
type CampaignForm = {
  title: string;
  kind: Campaign["kind"];
  subject: string;
  greeting: string;
  body: string;
  banner: CampaignBanner;
  services: CampaignService[];
  audienceMode: "all" | "selected";
  selectedRecipients: CampaignRecipient[];
  includeUnsubscribed: boolean;
  sendMode: "now" | "scheduled";
  scheduledAt: string;
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
  banner?: CampaignBanner;
  services: CampaignService[];
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  includeUnsubscribed: boolean;
  audienceMode: "all" | "selected";
  recipientUserIds?: CampaignRecipient[];
  scheduledAt: string;
  lastError?: string;
  bannerCleanupError?: string;
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

function uploadCampaignImage(file: File, onProgress: (progress: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", apiUrl("/api/admin/campaign-banner"));
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("Banner upload failed. Check your connection and try again."));
    request.onabort = () => reject(new Error("Banner upload was cancelled."));
    request.onload = () => {
      let result: { data?: { url?: string }; url?: string; message?: string };
      try {
        result = JSON.parse(request.responseText);
      } catch {
        reject(new Error(`Banner upload failed with status ${request.status}.`));
        return;
      }

      const url = result.data?.url ?? result.url;
      if (request.status < 200 || request.status >= 300 || typeof url !== "string") {
        reject(new Error(result.message ?? `Banner upload failed with status ${request.status}.`));
        return;
      }

      onProgress(100);
      resolve(url);
    };

    const formData = new FormData();
    formData.set("file", file);
    request.send(formData);
  });
}

function tintBannerColor(color: string, whiteAmount: number) {
  const hex = color.slice(1);
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  return `#${channels.map((channel) => Math.round(channel + (255 - channel) * whiteAmount).toString(16).padStart(2, "0")).join("")}`;
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
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientResults, setRecipientResults] = useState<CampaignRecipient[]>([]);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [campaignForm, setCampaignForm] = useState<CampaignForm>({
    title: "",
    kind: "announcement" as Campaign["kind"],
    subject: "",
    greeting: "Hello {{name}},",
    body: "",
    banner: { presetId: null, imageUrl: "", backgroundImageUrl: "", backgroundColor: "" },
    services: [],
    audienceMode: "all",
    selectedRecipients: [],
    includeUnsubscribed: false,
    sendMode: "now" as "now" | "scheduled",
    scheduledAt: localDateTimeValue(new Date()),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerUploadProgress, setBannerUploadProgress] = useState<number | null>(null);
  const [bannerUploadFileName, setBannerUploadFileName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const previewBannerPreset = CAMPAIGN_BANNER_PRESETS.find(({ id }) => id === campaignForm.banner.presetId);
  const previewPrimary = previewBannerPreset?.colors[0] ?? email.primaryColor;
  const previewAccent = previewBannerPreset?.colors[1] ?? email.accentColor;
  const previewBackgroundColor = campaignForm.banner.backgroundColor
    || (previewBannerPreset ? tintBannerColor(previewPrimary, 0.92) : "#f1f5f9");

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
      const { services, selectedRecipients, ...campaignPayload } = campaignForm;
      const response = await apiFetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...campaignPayload,
          serviceIds: services.map((service) => service.serviceId),
          serviceCountries: services.map(({ serviceId, country }) => ({ serviceId, country: country ?? "" })),
          recipientUserIds: selectedRecipients.map((recipient) => recipient._id),
          sendNow: campaignForm.sendMode === "now",
          scheduledAt: campaignForm.sendMode === "now"
            ? new Date().toISOString()
            : new Date(campaignForm.scheduledAt).toISOString(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to schedule campaign.");
      setMessage(campaignForm.sendMode === "now" ? "Campaign created. Starting delivery now…" : "Campaign confirmed and scheduled.");
      setCampaignForm((current) => ({
        ...current,
        title: "",
        subject: "",
        greeting: "Hello {{name}},",
        body: "",
        banner: { presetId: null, imageUrl: "", backgroundImageUrl: "", backgroundColor: "" },
        services: [],
        selectedRecipients: [],
      }));
      if (campaignForm.sendMode === "now") {
        let continueSending = true;
        let sent = 0;
        let failed = 0;
        let cleanupWarning: string | undefined;
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
          cleanupWarning = batch.cleanupWarning ?? cleanupWarning;
          sent += Number(batch.sent ?? 0);
          failed += Number(batch.failed ?? 0);
          continueSending = batch.hasMore === true;
          setMessage(
            continueSending
              ? `Sending campaign… ${sent + failed} of ${result.campaign?.recipientCount ?? "all"} processed.`
              : `Campaign delivery finished. ${sent} sent${failed ? `, ${failed} failed` : ""}.`,
          );
        }
        if (cleanupWarning) setError(`Campaign sent, but its uploaded image could not be deleted: ${cleanupWarning}`);
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
      const exclude = campaignForm.services.map((service) => service.serviceId).join(",");
      const result = await apiJson(`/api/admin/email-campaign-services?limit=${count}${exclude ? `&exclude=${encodeURIComponent(exclude)}` : ""}`);
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
          ? `Refreshed with ${services.length} different services${missingPlatforms.length ? `. No active ${missingPlatforms.join(" or ")} service was available to include` : ", including Instagram and YouTube"}.`
          : "No different active services are available for this refresh.",
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

  async function searchCampaignRecipients() {
    if (!recipientSearch.trim()) {
      setError("Enter a user's name, email, or phone to search.");
      return;
    }
    setRecipientLoading(true);
    setError("");
    try {
      const result = await apiJson(`/api/admin/users?q=${encodeURIComponent(recipientSearch.trim())}`);
      setRecipientResults((result.users ?? []) as CampaignRecipient[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to search users.");
    } finally {
      setRecipientLoading(false);
    }
  }

  function addCampaignRecipient(recipient: CampaignRecipient) {
    setCampaignForm((current) => current.selectedRecipients.some((item) => item._id === recipient._id)
      ? current
      : { ...current, selectedRecipients: [...current.selectedRecipients, recipient] });
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
      banner: {
        presetId: campaign.banner?.presetId ?? null,
        imageUrl: campaign.banner?.imageUrl ?? "",
        backgroundImageUrl: campaign.banner?.backgroundImageUrl ?? "",
        backgroundColor: campaign.banner?.backgroundColor ?? "",
      },
      services: campaign.services ?? [],
      audienceMode: campaign.audienceMode ?? "all",
      selectedRecipients: campaign.recipientUserIds ?? [],
      includeUnsubscribed: campaign.includeUnsubscribed,
      sendMode: "now",
      scheduledAt: localDateTimeValue(new Date()),
    });
    setError("");
    setMessage(`“${campaign.title}” loaded as a draft. Edit it and confirm when ready.`);
    document.getElementById("campaign-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function uploadCampaignBanner(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WEBP banner image.");
      return;
    }
    if (file.size > MAX_CAMPAIGN_IMAGE_SIZE) {
      setError("Banner image must be 10MB or smaller.");
      return;
    }

    setBannerUploading(true);
    setBannerUploadProgress(0);
    setBannerUploadFileName(file.name);
    setError("");
    setMessage("");
    try {
      const imageUrl = await uploadCampaignImage(file, setBannerUploadProgress);
      setCampaignForm((current) => ({
        ...current,
        banner: { ...current.banner, imageUrl },
      }));
      setMessage("Custom banner uploaded. It will appear in the preview and campaign email.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload banner image.");
    } finally {
      setBannerUploading(false);
      setBannerUploadProgress(null);
      setBannerUploadFileName("");
    }
  }

  async function uploadCampaignBackground(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WEBP email background image.");
      return;
    }
    if (file.size > MAX_CAMPAIGN_IMAGE_SIZE) {
      setError("Email background image must be 10MB or smaller.");
      return;
    }

    setBannerUploading(true);
    setBannerUploadProgress(0);
    setBannerUploadFileName(file.name);
    setError("");
    setMessage("");
    try {
      const backgroundImageUrl = await uploadCampaignImage(file, setBannerUploadProgress);
      setCampaignForm((current) => ({
        ...current,
        banner: { ...current.banner, backgroundImageUrl },
      }));
      setMessage("Email background uploaded and added to the preview.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload email background image.");
    } finally {
      setBannerUploading(false);
      setBannerUploadProgress(null);
      setBannerUploadFileName("");
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
              <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5" aria-labelledby="campaign-banner-heading">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800"><ImagePlus className="size-5" /></span>
                  <div>
                    <h3 id="campaign-banner-heading" className="font-bold text-neutral-900">Email banner <span className="font-medium text-neutral-500">(optional)</span></h3>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">Choose a festival design, upload your own JPG, PNG, or WEBP image (up to 10MB), or use both together. The preview and email show both selections.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {CAMPAIGN_BANNER_PRESETS.map((preset) => {
                    const selected = campaignForm.banner.presetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setCampaignForm((current) => ({
                          ...current,
                          banner: {
                            ...current.banner,
                            presetId: selected ? null : preset.id,
                          },
                        }))}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                          selected ? "border-teal-600 bg-teal-50 ring-2 ring-teal-600/20" : "border-neutral-200 hover:border-teal-300"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className="grid size-12 shrink-0 place-items-center rounded-lg text-2xl text-white"
                          style={{ backgroundImage: `linear-gradient(130deg, ${preset.colors[0]}, ${preset.colors[1]})` }}
                        >
                          {preset.emoji}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-neutral-900">{preset.name}</span>
                          <span className="block truncate text-xs text-neutral-500">{preset.title}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50">
                  <ImagePlus className="size-4" />
                  {bannerUploading ? "Uploading image…" : "Upload custom banner"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={bannerUploading}
                    onChange={(event) => {
                      void uploadCampaignBanner(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {campaignForm.banner.imageUrl && (
                  <div className="mt-4 flex flex-wrap items-start gap-3">
                    <Image
                      src={apiUrl(campaignForm.banner.imageUrl)}
                      alt="Custom campaign banner preview"
                      width={592}
                      height={320}
                      unoptimized
                      className="max-h-44 max-w-full rounded-xl border border-neutral-200 object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setCampaignForm((current) => ({
                        ...current,
                        banner: { ...current.banner, imageUrl: "", backgroundImageUrl: "", backgroundColor: "" },
                      }))}
                      className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                    >
                      Remove custom banner
                    </button>
                  </div>
                )}
                {campaignForm.banner.imageUrl && (
                  <div className="mt-4 grid gap-4 rounded-xl border border-dashed border-neutral-300 p-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-neutral-800">
                      Email background color <span className="font-normal text-neutral-500">(optional)</span>
                      <span className="mt-2 flex items-center gap-3">
                        <input
                          type="color"
                          aria-label="Email background color"
                          value={campaignForm.banner.backgroundColor || "#f1f5f9"}
                          onChange={(event) => setCampaignForm((current) => ({
                            ...current,
                            banner: { ...current.banner, backgroundColor: event.target.value },
                          }))}
                          className="size-10 rounded border border-neutral-300"
                        />
                        <button
                          type="button"
                          onClick={() => setCampaignForm((current) => ({
                            ...current,
                            banner: { ...current.banner, backgroundColor: "" },
                          }))}
                          className="text-xs font-semibold text-teal-800 hover:underline"
                        >
                          Use theme default
                        </button>
                      </span>
                    </label>
                    <div className="text-sm font-semibold text-neutral-800">
                      Email background image <span className="font-normal text-neutral-500">(optional)</span>
                      <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50">
                        <ImagePlus className="size-4" />
                        {bannerUploading ? "Uploading image…" : campaignForm.banner.backgroundImageUrl ? "Replace background image" : "Upload background image · auto-fit to email"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          disabled={bannerUploading}
                          onChange={(event) => {
                            void uploadCampaignBackground(event.target.files?.[0]);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {campaignForm.banner.backgroundImageUrl && (
                      <div className="flex items-start gap-3 sm:col-span-2">
                        <Image
                          src={apiUrl(campaignForm.banner.backgroundImageUrl)}
                          alt="Email background preview"
                          width={320}
                          height={120}
                          unoptimized
                          className="h-20 w-40 rounded-lg border border-neutral-200 object-cover"
                        />
                        <div>
                          <p className="text-xs text-neutral-600">Background auto-fits the email canvas.</p>
                          <button
                            type="button"
                            onClick={() => setCampaignForm((current) => ({
                              ...current,
                              banner: { ...current.banner, backgroundImageUrl: "" },
                            }))}
                            className="mt-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                          >
                            Remove background
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {bannerUploadProgress !== null && (
                  <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/70 p-3" role="status" aria-live="polite">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-neutral-700">
                        Uploading {bannerUploadFileName}
                      </span>
                      <span className="shrink-0 font-bold text-teal-800">{bannerUploadProgress}%</span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-teal-100"
                      role="progressbar"
                      aria-label="Image upload progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={bannerUploadProgress}
                    >
                      <div
                        className="h-full rounded-full bg-teal-700 transition-[width] duration-150"
                        style={{ width: `${bannerUploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </section>
              <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5" aria-labelledby="campaign-audience-heading">
                <h3 id="campaign-audience-heading" className="font-bold text-neutral-900">Recipients</h3>
                <label className="mt-3 block max-w-md text-sm font-semibold text-neutral-800">
                  Send to
                  <select
                    className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                    value={campaignForm.audienceMode}
                    onChange={(event) => setCampaignForm({ ...campaignForm, audienceMode: event.target.value as "all" | "selected" })}
                  >
                    <option value="all">All eligible users</option>
                    <option value="selected">Specific user(s) only</option>
                  </select>
                </label>
                {campaignForm.audienceMode === "selected" && (
                  <div className="mt-4">
                    <p className="text-xs text-neutral-500">Selected users: {campaignForm.selectedRecipients.length}/500. Marketing opt-outs remain excluded unless you explicitly enable the opt-out override below.</p>
                    {campaignForm.selectedRecipients.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {campaignForm.selectedRecipients.map((recipient) => (
                          <li key={recipient._id} className="flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 py-1 pl-3 pr-1 text-xs text-teal-900">
                            <span>{recipient.name} · {recipient.email}</span>
                            <button type="button" aria-label={`Remove ${recipient.email}`} onClick={() => setCampaignForm((current) => ({ ...current, selectedRecipients: current.selectedRecipients.filter((item) => item._id !== recipient._id) }))} className="grid size-6 place-items-center rounded-full hover:bg-teal-100"><X className="size-3.5" /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={recipientSearch}
                        onChange={(event) => setRecipientSearch(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchCampaignRecipients(); } }}
                        placeholder="Search users by name, email, or phone"
                        className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                      />
                      <button type="button" disabled={recipientLoading} onClick={() => void searchCampaignRecipients()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                        <Search className="size-4" /> {recipientLoading ? "Searching…" : "Find users"}
                      </button>
                    </div>
                    {recipientResults.length > 0 && (
                      <ul className="mt-3 max-h-60 divide-y divide-neutral-100 overflow-y-auto rounded-xl border border-neutral-200">
                        {recipientResults.map((recipient) => {
                          const selected = campaignForm.selectedRecipients.some((item) => item._id === recipient._id);
                          return (
                            <li key={recipient._id} className="flex items-center justify-between gap-3 p-3">
                              <div><p className="text-sm font-semibold text-neutral-900">{recipient.name}</p><p className="text-xs text-neutral-500">{recipient.email}</p></div>
                              <button type="button" disabled={selected || campaignForm.selectedRecipients.length >= 500} onClick={() => addCampaignRecipient(recipient)} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{selected ? "Added" : "Add"}</button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </section>
              <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5" aria-labelledby="campaign-services-heading">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 id="campaign-services-heading" className="font-bold text-neutral-900">Featured services <span className="font-medium text-neutral-500">({campaignForm.services.length}/10)</span></h3>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">Refresh to get a randomized set that excludes the currently displayed services. Assign a country label to each service when relevant.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={serviceLoading} onClick={() => void loadLatestServices(5)} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800 transition hover:bg-teal-50 disabled:opacity-50">
                      <Sparkles className="size-3.5" /> Refresh 5
                    </button>
                    <button type="button" disabled={serviceLoading} onClick={() => void loadLatestServices(10)} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800 transition hover:bg-teal-50 disabled:opacity-50">
                      <Sparkles className="size-3.5" /> Refresh 10
                    </button>
                  </div>
                </div>

                {campaignForm.services.length > 0 ? (
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {campaignForm.services.map((service) => (
                      <li key={service.serviceId} className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                        <div className="min-w-0 flex-1">
                          <span className="inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">{service.platform}</span>
                          <p className="mt-1 truncate text-sm font-bold text-neutral-900">{service.name}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">{service.category} · Rs.{Number(service.sellingRate).toFixed(2)} / 1k</p>
                          <label className="mt-2 block text-xs font-semibold text-neutral-700">
                            Related country
                            <input
                              list="campaign-service-countries"
                              maxLength={80}
                              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                              placeholder="Choose or type a country"
                              value={service.country ?? ""}
                              onChange={(event) => setCampaignForm((current) => ({
                                ...current,
                                services: current.services.map((item) => item.serviceId === service.serviceId ? { ...item, country: event.target.value } : item),
                              }))}
                            />
                          </label>
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
                <datalist id="campaign-service-countries">
                  {SERVICE_COUNTRIES.map((country) => <option key={country} value={country} />)}
                </datalist>

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
              <section className="rounded-2xl border border-neutral-200 bg-white p-4" aria-label="Campaign email preview">
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Email preview</p>
                <div
                  className="mt-3 rounded-xl p-3 sm:p-6"
                  style={{
                    backgroundColor: previewBackgroundColor,
                    backgroundImage: campaignForm.banner.backgroundImageUrl
                      ? `url("${apiUrl(campaignForm.banner.backgroundImageUrl)}")`
                      : undefined,
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "cover",
                  }}
                >
                  <div className="mx-auto max-w-2xl overflow-hidden border border-neutral-200/80 bg-white shadow-sm">
                    <div
                      className="px-5 py-5 text-white sm:px-7"
                      style={{ backgroundColor: previewPrimary, backgroundImage: `linear-gradient(125deg, ${previewPrimary}, ${previewAccent})` }}
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.16em]">{email.brandName}</p>
                      <h3 className="mt-2 text-xl font-bold">{campaignForm.subject || "Email subject preview"}</h3>
                    </div>
                    {previewBannerPreset && (
                      <div
                        className="px-5 py-7 text-center text-white sm:py-9"
                        style={{ backgroundColor: previewBannerPreset.colors[0], backgroundImage: `linear-gradient(120deg, ${previewBannerPreset.colors[0]}, ${previewBannerPreset.colors[1]})` }}
                      >
                        <span className="block text-4xl" aria-hidden="true">{previewBannerPreset.emoji}</span>
                        <span className="mt-2 block text-xl font-bold">{previewBannerPreset.title}</span>
                      </div>
                    )}
                    {campaignForm.banner.imageUrl && (
                      <Image
                        src={apiUrl(campaignForm.banner.imageUrl)}
                        alt="Custom campaign banner preview"
                        width={640}
                        height={320}
                        unoptimized
                        className="block h-auto w-full"
                      />
                    )}
                    <div className="px-5 py-5 text-sm leading-6 text-neutral-700 sm:px-7">
                      <p className="font-semibold" style={{ color: previewPrimary }}>
                        {campaignForm.greeting.replaceAll("{{name}}", "Alex Morgan").replaceAll("{{email}}", "alex@example.com").replaceAll("{{brandName}}", email.brandName) || "Greeting preview"}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap">
                        {campaignForm.body.replaceAll("{{name}}", "Alex Morgan").replaceAll("{{email}}", "alex@example.com").replaceAll("{{brandName}}", email.brandName) || "Your message preview will appear here."}
                      </p>
                    </div>
                    {campaignForm.services.length > 0 && (
                      <div className="grid gap-2 border-t border-neutral-100 px-5 py-4 sm:grid-cols-2 sm:px-7">
                        {campaignForm.services.map((service) => (
                          <div key={service.serviceId} className="rounded-lg border border-neutral-200 bg-white p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: previewAccent }}>{service.platform}</span>
                            <p className="mt-1 text-sm font-bold text-neutral-900">{service.name}</p>
                            <p className="mt-1 text-xs text-neutral-500">{service.category}{service.country ? ` · ${service.country}` : ""} · Rs.{Number(service.sellingRate).toFixed(2)} / 1k</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-neutral-200 px-5 py-3 text-center text-xs text-neutral-500 sm:px-7">
                      {email.brandName} · Unsubscribe from marketing emails
                    </div>
                  </div>
                </div>
              </section>
              <button disabled={saving} className="w-fit rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? (campaignForm.sendMode === "now" ? "Starting…" : "Scheduling…") : (campaignForm.sendMode === "now" ? "Confirm and send now" : "Confirm and schedule campaign")}</button>
            </form>
          </AdminSection>

          <AdminSection title="Recent email campaigns" description="Duplicate any campaign to reuse its content as an editable draft. Delivery runs in resumable batches.">
            {campaigns.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-neutral-500"><tr><th className="p-3">Campaign</th><th className="p-3">Status</th><th className="p-3">Scheduled</th><th className="p-3">Recipients</th><th className="p-3">Sent / failed</th><th className="p-3">Unsubscribed included</th><th className="p-3">Delivery details</th><th className="p-3">Actions</th></tr></thead>
                  <tbody>{campaigns.map((campaign) => <tr key={campaign._id} className="border-t border-neutral-100"><td className="p-3"><span className="font-semibold">{campaign.title}</span><span className="block text-xs text-neutral-500">{campaign.kind}: {campaign.subject}</span></td><td className="p-3 capitalize">{campaign.status}</td><td className="p-3 whitespace-nowrap">{new Date(campaign.scheduledAt).toLocaleString()}</td><td className="p-3">{campaign.recipientCount}</td><td className="p-3">{campaign.sentCount} / {campaign.failedCount}</td><td className="p-3">{campaign.includeUnsubscribed ? "Yes" : "No"}</td><td className="max-w-xs p-3 text-xs text-rose-700">{campaign.lastError || campaign.bannerCleanupError || "—"}</td><td className="p-3"><button type="button" onClick={() => duplicateCampaign(campaign)} className="whitespace-nowrap rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800 transition hover:bg-teal-50">Duplicate &amp; edit</button></td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="p-5 text-sm text-neutral-500">No campaigns created yet.</p>}
          </AdminSection>
        </div>
      )}
    </AppShell>
  );
}
