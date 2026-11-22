"use client";

import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { PopupMedia } from "@/components/popup-media";
import { apiJson, apiUrl } from "@/lib/client-api";
import { popupMediaForDevices, resolvePopupMedia } from "@/lib/popup-media";

type PopupKind = "announcement" | "advertisement";
type PopupLinkType = "none" | "internal" | "external";
type PopupForm = {
  title: string;
  kind: PopupKind;
  message: string;
  emoji: string;
  imageUrl: string;
  mobileImageUrl: string;
  desktopImageUrl: string;
  linkType: PopupLinkType;
  linkHref: string;
  linkLabel: string;
  startsAt: string;
  expiresAt: string;
  calendarEventKey: string;
  autoCloseAfterSeconds: number;
  slideshowGroupId: string;
  showOnEveryRefresh: boolean;
  active: boolean;
};
type Popup = Omit<PopupForm, "startsAt" | "expiresAt"> & {
  _id: string;
  startsAt: string;
  expiresAt: string;
};
type ServiceOption = { _id: string; name: string; category: string; active: boolean };

function localDateTimeValue(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function emptyPopupForm(): PopupForm {
  const now = new Date();
  return {
    title: "",
    kind: "announcement",
    message: "",
    emoji: "✨",
    imageUrl: "",
    mobileImageUrl: "",
    desktopImageUrl: "",
    linkType: "none",
    linkHref: "",
    linkLabel: "",
    startsAt: localDateTimeValue(now),
    expiresAt: localDateTimeValue(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)),
    calendarEventKey: "",
    autoCloseAfterSeconds: 0,
    slideshowGroupId: "",
    showOnEveryRefresh: false,
    active: true,
  };
}

function uploadPopupImage(file: File, onProgress: (progress: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", apiUrl("/api/admin/site-popup-image"));
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("Popup image upload failed. Check your connection and try again."));
    request.onabort = () => reject(new Error("Popup image upload was cancelled."));
    request.onload = () => {
      let result: { data?: { url?: string }; message?: string };
      try {
        result = JSON.parse(request.responseText);
      } catch {
        reject(new Error(`Popup image upload failed with status ${request.status}.`));
        return;
      }

      const url = result.data?.url;
      if (request.status < 200 || request.status >= 300 || typeof url !== "string") {
        reject(new Error(result.message ?? `Popup image upload failed with status ${request.status}.`));
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

function isUploadedPopupImage(imageUrl: string) {
  return /^\/api\/uploads\/file\/popup-images\/[a-f\d-]+\.(?:jpg|png|webp)$/i.test(imageUrl);
}

async function removeUnusedPopupImage(imageUrl: string) {
  if (!isUploadedPopupImage(imageUrl)) return;
  const result = await apiJson("/api/admin/site-popup-image", {
    method: "DELETE",
    body: JSON.stringify({ imageUrl }),
  });
  if (!result?.ok) throw new Error(result?.message ?? "Unable to remove the unused popup image.");
}

function popupStatus(popup: Popup) {
  const now = Date.now();
  if (!popup.active) return { label: "Paused", className: "bg-neutral-100 text-neutral-600" };
  if (new Date(popup.expiresAt).getTime() <= now) return { label: "Expired", className: "bg-rose-50 text-rose-700" };
  if (new Date(popup.startsAt).getTime() > now) return { label: "Scheduled", className: "bg-amber-50 text-amber-800" };
  return { label: "Live", className: "bg-emerald-50 text-emerald-700" };
}

export default function PopupManagementPage() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [searchingServices, setSearchingServices] = useState(false);
  const [form, setForm] = useState<PopupForm>(emptyPopupForm);
  const [slideshowDurationSeconds, setSlideshowDurationSeconds] = useState(10);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSlideshowSettings, setSavingSlideshowSettings] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const hasPopupMedia = Boolean(form.imageUrl || form.mobileImageUrl || form.desktopImageUrl);
  const previewMedia = popupMediaForDevices(form);

  async function loadData() {
    try {
      const [popupData, serviceData] = await Promise.all([
        apiJson("/api/admin/site-popups"),
        apiJson("/api/admin/services"),
      ]);
      if (!popupData?.ok) throw new Error(popupData?.message ?? "Unable to load popup campaigns.");
      if (!serviceData?.ok) throw new Error(serviceData?.message ?? "Unable to load services for popup links.");
      setError("");
      setPopups(popupData.popups ?? []);
      setSlideshowDurationSeconds(popupData.slideshowDurationSeconds ?? 10);
      setServices((serviceData.services ?? []).filter((service: ServiceOption) => service.active));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load popup campaigns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const calendarDate = query.get("calendarDate");
    const calendarTitle = query.get("calendarTitle");
    if (!calendarDate || !calendarTitle || !/^\d{4}-\d{2}-\d{2}$/.test(calendarDate)) return;
    const [year, month, day] = calendarDate.split("-").map(Number);
    const parsedDate = new Date(year, month - 1, day);
    if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) return;
    const startsAt = new Date(year, month - 1, day, 10);
    if (startsAt.getTime() <= Date.now()) startsAt.setTime(Date.now() + 60 * 60 * 1000);
    const expiresAt = new Date(year, month - 1, day + 1, 23, 59);
    // The calendar handoff seeds this editor from validated URL data on first mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((current) => ({
      ...current,
      title: (query.get("popupTitle") || calendarTitle).slice(0, 120),
      kind: "advertisement",
      message: query.get("message") ?? "",
      startsAt: localDateTimeValue(startsAt),
      expiresAt: localDateTimeValue(expiresAt),
      calendarEventKey: query.get("calendarEventKey") ?? "",
      active: true,
    }));
    setMessage(`Calendar popup draft for ${calendarTitle} loaded. Review it before publishing.`);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function searchServices() {
    setSearchingServices(true);
    setError("");
    try {
      const query = serviceSearch.trim();
      const result = await apiJson(`/api/admin/services${query ? `?q=${encodeURIComponent(query)}` : ""}`);
      if (!result?.ok) throw new Error(result?.message ?? "Unable to search services.");
      setServices((result.services ?? []).filter((service: ServiceOption) => service.active));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to search services.");
    } finally {
      setSearchingServices(false);
    }
  }

  function editPopup(popup: Popup) {
    setEditingId(popup._id);
    setForm({
      title: popup.title,
      kind: popup.kind,
      message: popup.message,
      emoji: popup.emoji || "✨",
      imageUrl: "",
      mobileImageUrl: popup.mobileImageUrl || popup.imageUrl || popup.desktopImageUrl || "",
      desktopImageUrl: popup.desktopImageUrl || popup.imageUrl || popup.mobileImageUrl || "",
      linkType: popup.linkType ?? (popup.linkHref ? "internal" : "none"),
      linkHref: popup.linkHref || "",
      linkLabel: popup.linkLabel || "",
      startsAt: localDateTimeValue(new Date(popup.startsAt)),
      expiresAt: localDateTimeValue(new Date(popup.expiresAt)),
      calendarEventKey: popup.calendarEventKey ?? "",
      autoCloseAfterSeconds: popup.autoCloseAfterSeconds ?? 0,
      slideshowGroupId: popup.slideshowGroupId || "",
      showOnEveryRefresh: popup.showOnEveryRefresh ?? false,
      active: popup.active,
    });
    setMessage(`Editing “${popup.title || "image-only popup"}”. Save changes when you're ready.`);
    setError("");
    document.getElementById("popup-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm() {
    for (const imageUrl of new Set([form.imageUrl, form.mobileImageUrl, form.desktopImageUrl].filter(Boolean))) {
      void removeUnusedPopupImage(imageUrl).catch((cause) => {
        console.error("Unable to clean up an unused popup image.", cause);
      });
    }
    setEditingId("");
    setForm(emptyPopupForm());
    setError("");
    setMessage("");
  }

  async function handlePopupImage(file: File | undefined, device: "mobile" | "desktop") {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WEBP popup image.");
      return;
    }
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      setError("Popup image must be larger than 0 bytes and 10MB or smaller.");
      return;
    }

    const field = device === "mobile" ? "mobileImageUrl" : "desktopImageUrl";
    const otherField = device === "mobile" ? "desktopImageUrl" : "mobileImageUrl";
    const previousImageUrl = form[field];
    const otherImageUrl = form[otherField];
    setUploadingImage(true);
    setUploadProgress(0);
    setError("");
    setMessage("");
    try {
      const imageUrl = await uploadPopupImage(file, setUploadProgress);
      setForm((current) => ({ ...current, imageUrl: "", [field]: imageUrl }));
      if (previousImageUrl && previousImageUrl !== imageUrl && previousImageUrl !== otherImageUrl) {
        await removeUnusedPopupImage(previousImageUrl);
      }
      setMessage("Popup image uploaded. Review the preview and save your campaign.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload popup image.");
    } finally {
      setUploadingImage(false);
      setUploadProgress(null);
    }
  }

  function updatePopupMediaUrl(device: "mobile" | "desktop", imageUrl: string) {
    const field = device === "mobile" ? "mobileImageUrl" : "desktopImageUrl";
    const otherField = device === "mobile" ? "desktopImageUrl" : "mobileImageUrl";
    const previousImageUrl = form[field];
    const otherImageUrl = form[otherField];
    setForm((current) => ({ ...current, imageUrl: "", [field]: imageUrl }));
    if (previousImageUrl && previousImageUrl !== imageUrl && previousImageUrl !== otherImageUrl) {
      void removeUnusedPopupImage(previousImageUrl).catch((cause) => {
        console.error("Unable to clean up a replaced popup image.", cause);
      });
    }
  }

  function removePopupImage(device: "mobile" | "desktop") {
    updatePopupMediaUrl(device, "");
    setError("");
    setMessage("Popup media removed. Save the campaign to publish this change.");
  }

  async function savePopup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await apiJson("/api/admin/site-popups", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...form,
          linkHref: form.linkHref.trim(),
          linkLabel: form.linkHref.trim() ? (form.linkLabel.trim() || "Explore now") : "",
          startsAt: new Date(form.startsAt).toISOString(),
          expiresAt: new Date(form.expiresAt).toISOString(),
          ...(editingId ? { id: editingId } : {}),
        }),
      });
      if (!result?.ok) throw new Error(result?.message ?? "Unable to save popup campaign.");
      const savedMessage = editingId ? "Popup campaign updated." : "Popup campaign created.";
      resetForm();
      setMessage(savedMessage);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save popup campaign.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSlideshowSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSlideshowSettings(true);
    setError("");
    setMessage("");
    try {
      const result = await apiJson("/api/admin/site-popups", {
        method: "PATCH",
        body: JSON.stringify({ slideshowDurationSeconds }),
      });
      if (!result?.ok) throw new Error(result?.message ?? "Unable to save slideshow settings.");
      setMessage("Slideshow duration saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save slideshow settings.");
    } finally {
      setSavingSlideshowSettings(false);
    }
  }

  async function togglePopup(popup: Popup) {
    setError("");
    setMessage("");
    try {
      const result = await apiJson("/api/admin/site-popups", {
        method: "PATCH",
        body: JSON.stringify({ id: popup._id, active: !popup.active }),
      });
      if (!result?.ok) throw new Error(result?.message ?? "Unable to update popup status.");
      setMessage(result.popup.active ? "Popup campaign activated." : "Popup campaign paused.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update popup status.");
    }
  }

  async function deletePopup(popup: Popup) {
    if (!window.confirm(`Permanently delete “${popup.title || "image-only popup"}”?`)) return;
    setError("");
    setMessage("");
    try {
      const result = await apiJson("/api/admin/site-popups", {
        method: "DELETE",
        body: JSON.stringify({ id: popup._id }),
      });
      if (!result?.ok) throw new Error(result?.message ?? "Unable to delete popup.");
      setMessage("Popup campaign deleted.");
      if (editingId === popup._id) resetForm();
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete popup.");
    }
  }

  const popupById = new Map<string, Popup>();
  for (const popup of popups) popupById.set(popup._id, popup);
  const mergeTargets = new Map<string, Popup>();
  for (const popup of popups) {
    const rootId = popup.slideshowGroupId || popup._id;
    mergeTargets.set(rootId, popupById.get(rootId) ?? popup);
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Customer experience"
        title="Popup announcements"
        description="Create polished festival wishes, announcements, and special offers. Schedule several campaigns, link directly to a service, and let each popup expire automatically."
      />
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

      <AdminSection title="Campaign slideshow" description="Unmerged campaigns share one animated round. Campaigns merged with a base campaign share that base campaign’s custom total time; if it has no custom time, the shared total is used.">
        <form onSubmit={saveSlideshowSettings} className="flex flex-wrap items-end gap-3 p-4 sm:p-6">
          <label className="block min-w-48 flex-1 text-sm font-semibold text-neutral-800">
            Total slideshow time (seconds)
            <input
              type="number"
              min={3}
              max={3600}
              step={1}
              required
              value={slideshowDurationSeconds}
              onChange={(event) => setSlideshowDurationSeconds(Number(event.target.value))}
              className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
            />
            <span className="mt-1 block text-xs font-normal text-neutral-500">This is the total time for one round of unmerged campaigns and the fallback for merged groups without a custom base time. Range: 3–3600 seconds.</span>
          </label>
          <button disabled={savingSlideshowSettings} className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:opacity-60">
            {savingSlideshowSettings ? "Saving…" : "Save slideshow time"}
          </button>
        </form>
      </AdminSection>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <AdminSection
          title={editingId ? "Edit popup campaign" : "Create a popup campaign"}
          description="The popup follows your selected website theme and appears to customers while it's live."
        >
          <form id="popup-composer" onSubmit={savePopup} className="grid gap-4 p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-neutral-800">
                Campaign type
                <select
                  value={form.kind}
                  onChange={(event) => setForm({ ...form, kind: event.target.value as PopupKind })}
                  className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="announcement">Announcement / festival wishes</option>
                  <option value="advertisement">Offer / advertisement</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-neutral-800">
                Popup icon
                <select
                  value={form.emoji}
                  onChange={(event) => setForm({ ...form, emoji: event.target.value })}
                  className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-lg"
                >
                  {["✨", "🎉", "🎊", "🎁", "📣", "🌟", "❤️", "🙏"].map((emoji) => <option key={emoji} value={emoji}>{emoji}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-sm font-semibold text-neutral-800">
              Heading {hasPopupMedia && <span className="font-normal text-neutral-500">(optional with media)</span>}
              <input
                required={!hasPopupMedia}
                minLength={hasPopupMedia ? undefined : 2}
                maxLength={120}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="e.g. Diwali special — save on your next order"
                className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
              />
              <span className="mt-1 block text-xs font-normal text-neutral-500">Use {"{{brandName}}"} to insert the current website brand.</span>
            </label>
            <label className="block text-sm font-semibold text-neutral-800">
              Message {hasPopupMedia && <span className="font-normal text-neutral-500">(optional with media)</span>}
              <textarea
                required={!hasPopupMedia}
                minLength={hasPopupMedia ? undefined : 2}
                maxLength={2000}
                rows={4}
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                placeholder="Share your greeting, offer details, and any useful information."
                className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-6"
              />
              <span className="mt-1 block text-xs font-normal text-neutral-500">Use {"{{brandName}}"} to insert the current website brand.</span>
              <span className="mt-1 block text-right text-xs font-normal text-neutral-500">{form.message.length}/2000</span>
            </label>

            <section className="grid gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4" aria-labelledby="popup-media-heading">
              <div>
                <h3 id="popup-media-heading" className="text-sm font-bold text-neutral-900">Device-specific popup media <span className="font-normal text-neutral-500">(optional · uploads up to 10MB)</span></h3>
                <p className="mt-1 text-xs text-neutral-500">Add separate mobile and desktop images/videos. If you fill only one, that media is used on both devices. Direct image/video links and YouTube/Vimeo links are supported.</p>
              </div>
              {([
                { device: "mobile", label: "Mobile / phone", value: form.mobileImageUrl },
                { device: "desktop", label: "Desktop / PC", value: form.desktopImageUrl },
              ] as const).map(({ device, label, value }) => (
                <div key={device} className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-3 sm:p-4">
                  <h4 className="text-sm font-bold text-neutral-800">{label} popup media</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50">
                      <ImagePlus className="size-4" />
                      {uploadingImage ? "Uploading image…" : value ? "Replace uploaded image" : "Upload image"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        disabled={uploadingImage}
                        onChange={(event) => {
                          void handlePopupImage(event.target.files?.[0], device);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {value && (
                      <button type="button" disabled={uploadingImage} onClick={() => removePopupImage(device)} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                        <X className="size-3.5" /> Remove
                      </button>
                    )}
                  </div>
                  <label className="block text-xs font-semibold text-neutral-700">
                    Or paste a public image/video URL
                    <input
                      type="url"
                      maxLength={2048}
                      value={isUploadedPopupImage(value) ? "" : value}
                      disabled={uploadingImage}
                      onChange={(event) => updatePopupMediaUrl(device, event.target.value)}
                      placeholder="https://example.com/popup-image.jpg or video link"
                      className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal"
                    />
                  </label>
                  {uploadProgress !== null && uploadingImage && (
                    <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3" role="status" aria-live="polite">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-neutral-700">Uploading {label.toLowerCase()} image</span>
                        <span className="font-bold text-teal-800">{uploadProgress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-teal-100" role="progressbar" aria-label={`${label} image upload progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}>
                        <div className="h-full rounded-full bg-teal-700 transition-[width] duration-150" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                  {value && (
                    <div className="flex min-h-32 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950 sm:min-h-48">
                      <PopupMedia url={value} alt={`${label} popup media preview`} width={640} height={360} className="max-h-64 max-w-full object-contain" />
                    </div>
                  )}
                </div>
              ))}
            </section>

            <div className="grid gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <h3 className="text-sm font-bold text-neutral-900">Optional destination</h3>
              <label className="block text-sm font-semibold text-neutral-800">
                Link type
                <select
                  value={form.linkType}
                  required
                  onChange={(event) => setForm({
                    ...form,
                    linkType: event.target.value as PopupLinkType,
                    linkHref: "",
                    linkLabel: "",
                  })}
                  className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="none">No link</option>
                  <option value="internal">Internal website page or service</option>
                  <option value="external">External website link</option>
                </select>
                <span className="mt-1 block text-xs font-normal text-neutral-500">A link is optional. Every destination opens in the same tab.</span>
              </label>
                {form.linkType === "internal" && <label className="block text-sm font-semibold text-neutral-800">
                Link directly to a service
                <span className="mt-1 flex gap-2">
                  <input
                    value={serviceSearch}
                    onChange={(event) => setServiceSearch(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchServices(); } }}
                    placeholder="Search any active service"
                    className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal"
                  />
                  <button type="button" disabled={searchingServices} onClick={() => void searchServices()} className="rounded-xl border border-neutral-300 px-3 text-xs font-bold text-neutral-700 hover:bg-white disabled:opacity-50">
                    {searchingServices ? "Searching…" : "Search"}
                  </button>
                </span>
                <select
                  value={form.linkHref.match(/^\/dashboard\/services\?serviceId=([a-f\d]{24})$/i)?.[1] ?? ""}
                  onChange={(event) => setForm({
                    ...form,
                    linkHref: event.target.value ? `/dashboard/services?serviceId=${event.target.value}` : "",
                    linkLabel: event.target.value ? (form.linkLabel || "View this service") : "",
                  })}
                  className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">No service selected</option>
                  {services.map((service) => (
                    <option key={service._id} value={service._id}>{service.name} · {service.category}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-neutral-500">Customers land on the service catalog with this service selected in the order builder.</span>
              </label>}
              {form.linkType === "internal" && <label className="block text-sm font-semibold text-neutral-800">
                Internal page path
                <input
                  required
                  value={form.linkHref}
                  onChange={(event) => setForm({ ...form, linkHref: event.target.value })}
                  placeholder="/dashboard/services or /dashboard/wallet"
                  className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
                />
                <span className="mt-1 block text-xs font-normal text-neutral-500">Use a path on this website, e.g. /dashboard/wallet. Or choose an active service above.</span>
              </label>}
              {form.linkType === "external" && <label className="block text-sm font-semibold text-neutral-800">
                External URL
                <input
                  required
                  type="url"
                  value={form.linkHref}
                  onChange={(event) => setForm({ ...form, linkHref: event.target.value })}
                  placeholder="https://example.com/offer"
                  className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
                />
                <span className="mt-1 block text-xs font-normal text-neutral-500">Enter a full http:// or https:// URL. It opens in this same tab.</span>
              </label>}
              {form.linkType !== "none" && form.linkHref && (
                <label className="block text-sm font-semibold text-neutral-800">
                  Button label
                  <input
                    maxLength={60}
                    value={form.linkLabel}
                    onChange={(event) => setForm({ ...form, linkLabel: event.target.value })}
                    placeholder="Explore now"
                    className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
                  />
                </label>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-neutral-800">
                Starts at
                <input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-sm font-semibold text-neutral-800">
                Automatically expires at
                <input required type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm" />
              </label>
            </div>
            {!editingId && (
              <label className="block text-sm font-semibold text-neutral-800">
                Merge with existing campaign (optional)
                <select
                  value={form.slideshowGroupId}
                  onChange={(event) => setForm({
                    ...form,
                    slideshowGroupId: event.target.value,
                    autoCloseAfterSeconds: event.target.value ? 0 : form.autoCloseAfterSeconds,
                  })}
                  className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">No merge — use the shared slideshow</option>
                  {Array.from(mergeTargets, ([groupId, campaign]) => (
                    <option key={groupId} value={groupId}>
                      {campaign.title || "Image-only campaign"} — {campaign.autoCloseAfterSeconds > 0
                        ? `${campaign.autoCloseAfterSeconds}s group total`
                        : `${slideshowDurationSeconds}s shared total`}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-neutral-500">The selected campaign is the group’s base. Its total display time is divided evenly among it and all merged campaigns.</span>
              </label>
            )}
            <label className="block text-sm font-semibold text-neutral-800">
              Custom display time for this campaign (seconds)
              <input
                type="number"
                min={0}
                max={3600}
                step={1}
                value={form.autoCloseAfterSeconds}
                disabled={Boolean(form.slideshowGroupId)}
                onChange={(event) => setForm({ ...form, autoCloseAfterSeconds: Number(event.target.value) })}
                required
                className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
              />
              <span className="mt-1 block text-xs font-normal text-neutral-500">
                {form.slideshowGroupId
                  ? "Merged campaigns use the selected base campaign’s total time; this campaign’s own timer is ignored."
                  : `Enter 0 to use this campaign’s share of the ${slideshowDurationSeconds}-second shared total. Set 3–3600 seconds to use a custom time, or to set the total for campaigns merged into this one.`}
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={form.showOnEveryRefresh}
                onChange={(event) => setForm({ ...form, showOnEveryRefresh: event.target.checked })}
                className="mt-0.5 size-4 rounded accent-teal-700"
              />
              <span>
                <span className="block font-semibold">Show again on every page refresh</span>
                <span className="mt-0.5 block text-xs text-neutral-500">When enabled, closing or auto-closing only hides it until the page is refreshed. “Hide this popup for today” still applies.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-neutral-700">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="mt-0.5 size-4 rounded accent-teal-700" />
              <span><span className="block font-semibold">Publish this popup</span><span className="mt-0.5 block text-xs text-neutral-500">It will only appear between the start and expiry times above.</span></span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button disabled={saving || uploadingImage} className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:opacity-60">
                {uploadingImage ? "Wait for image upload…" : saving ? "Saving…" : editingId ? "Save changes" : "Create popup"}
              </button>
              {editingId && <button type="button" disabled={saving || uploadingImage} onClick={resetForm} className="rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">Cancel edit</button>}
            </div>
          </form>
        </AdminSection>

        <div className="grid content-start gap-6">
          <AdminSection title="Live preview" description="Popup colors automatically follow the selected website theme.">
            <div className="p-4 sm:p-5">
              <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-neutral-200 border-t-4 bg-white shadow-xl" style={{ borderTopColor: "var(--motion-accent)" }}>
                {previewMedia.mobileImageUrl && (
                  <div className="relative mx-auto aspect-[9/16] max-h-[55dvh] w-full max-w-[280px] overflow-hidden bg-neutral-950 md:hidden">
                    <PopupMedia url={previewMedia.mobileImageUrl} alt="Mobile popup media preview" fill sizes="280px" className="h-full w-full object-contain" />
                  </div>
                )}
                {previewMedia.desktopImageUrl && (
                  <div className="relative hidden aspect-video max-h-[55dvh] w-full overflow-hidden bg-neutral-950 md:block">
                    <PopupMedia url={previewMedia.desktopImageUrl} alt="Desktop popup media preview" fill sizes="(max-width: 768px) 100vw, 640px" className="h-full w-full object-contain" />
                  </div>
                )}
                <div className={hasPopupMedia && !form.title && !form.message && !form.linkHref ? "" : "p-6"}>
                  {!hasPopupMedia && <span className="grid size-12 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--motion-accent)_14%,white)] text-2xl">{form.emoji}</span>}
                  {(form.title || form.message || !hasPopupMedia) && <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--motion-accent)]">{form.kind === "advertisement" ? "A special offer" : "A message for you"}</p>}
                  {(form.title || !hasPopupMedia) && <h3 className="mt-2 text-xl font-bold text-neutral-950">{form.title || "Your announcement heading"}</h3>}
                  {(form.message || !hasPopupMedia) && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-neutral-600">{form.message || "Your announcement or offer details will appear here."}</p>}
                  {form.linkHref && <span className="mt-5 inline-flex rounded-xl bg-[var(--motion-accent)] px-4 py-2 text-xs font-bold text-white">{form.linkLabel || "Explore now"} →</span>}
                </div>
              </div>
            </div>
          </AdminSection>

          <AdminSection title={`Your popup campaigns (${popups.length})`} description="Several active campaigns can run together. Customers see eligible popups one at a time.">
            {loading ? (
              <p className="p-5 text-sm text-neutral-500">Loading popup campaigns…</p>
            ) : popups.length ? (
              <ul className="divide-y divide-neutral-100">
                {popups.map((popup) => {
                  const status = popupStatus(popup);
                  const popupMedia = popupMediaForDevices(popup);
                  const media = resolvePopupMedia(popupMedia.mobileImageUrl || popupMedia.desktopImageUrl);
                  return (
                    <li key={popup._id} className="p-4">
                      <div className="flex items-start gap-3">
                        {media?.type === "image"
                          ? <Image src={media.src} alt={`${popup.title || "Popup"} campaign image`} width={48} height={48} unoptimized className="size-10 shrink-0 rounded-xl object-cover" />
                          : media
                            ? <span aria-label="Video popup" className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-lg text-neutral-700">▶</span>
                          : <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-xl">{popup.emoji}</span>}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-bold text-neutral-900">{popup.title || "Image-only campaign"}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                          </div>
                          {popup.message && <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">{popup.message}</p>}
                          <p className="mt-2 text-[10px] text-neutral-400">Ends {new Date(popup.expiresAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 pl-[52px]">
                        <button type="button" onClick={() => editPopup(popup)} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">Edit</button>
                        <button type="button" onClick={() => void togglePopup(popup)} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">{popup.active ? "Pause" : "Activate"}</button>
                        <button type="button" onClick={() => void deletePopup(popup)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50">Delete</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="p-5 text-sm text-neutral-500">No popup campaigns yet. Create one to share an offer or announcement with customers.</p>
            )}
          </AdminSection>
        </div>
      </div>
    </AppShell>
  );
}
