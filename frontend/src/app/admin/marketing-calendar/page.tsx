"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ExternalLink,
  LoaderCircle,
  Mail,
  Megaphone,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { apiJson } from "@/lib/client-api";

type CalendarCategory = "festival" | "promotion" | "announcement" | "other";
type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  category: CalendarCategory;
  source: "admin" | "google";
};
type ScheduledCampaign = {
  id: string;
  channel: "email" | "popup";
  title: string;
  kind: "announcement" | "advertisement";
  status: string;
  date: string;
  scheduledAt: string;
  expiresAt?: string;
};
type EventForm = {
  title: string;
  description: string;
  date: string;
  category: CalendarCategory;
};
type CampaignDraft = {
  email: { title: string; subject: string; body: string };
  popup: { title: string; message: string };
};
type CalendarResponse = {
  ok?: boolean;
  message?: string;
  events?: CalendarEvent[];
  holidays?: CalendarEvent[];
  scheduledCampaigns?: ScheduledCampaign[];
  googleCalendarConfigured?: boolean;
  googleCalendarError?: string;
};
type SettingsResponse = {
  ai?: { enabled?: boolean; keyConfigured?: boolean };
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function emptyForm(date: string): EventForm {
  return { title: "", description: "", date, category: "other" };
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function eventColor(event: CalendarEvent) {
  if (event.source === "google") return "border-amber-200 bg-amber-50 text-amber-900";
  if (event.category === "promotion") return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900";
  if (event.category === "announcement") return "border-sky-200 bg-sky-50 text-sky-900";
  if (event.category === "festival") return "border-orange-200 bg-orange-50 text-orange-900";
  return "border-teal-200 bg-teal-50 text-teal-900";
}

function composerUrl(section: "email" | "popups", event: CalendarEvent, draft?: CampaignDraft) {
  const query = new URLSearchParams({
    calendarDate: event.date,
    calendarTitle: event.title,
  });
  if (draft && section === "email") {
    query.set("campaignTitle", draft.email.title);
    query.set("subject", draft.email.subject);
    query.set("body", draft.email.body);
  }
  if (draft && section === "popups") {
    query.set("popupTitle", draft.popup.title);
    query.set("message", draft.popup.message);
  }
  return `/admin/${section}?${query.toString()}` as Route;
}

export default function MarketingCalendarPage() {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [holidays, setHolidays] = useState<CalendarEvent[]>([]);
  const [campaigns, setCampaigns] = useState<ScheduledCampaign[]>([]);
  const [form, setForm] = useState<EventForm>(() => emptyForm(dateKey(new Date())));
  const [editingId, setEditingId] = useState("");
  const [draftEvent, setDraftEvent] = useState<CalendarEvent | null>(null);
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiKeyConfigured, setAiKeyConfigured] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const monthValue = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    setLoading(true);
    Promise.all([
      apiJson(`/api/admin/marketing-calendar?month=${monthValue}`) as Promise<CalendarResponse>,
      apiJson("/api/admin/settings") as Promise<SettingsResponse>,
    ])
      .then(([calendar, settings]) => {
        if (!calendar.ok) throw new Error(calendar.message ?? "Unable to load calendar events.");
        if (!active) return;
        setEvents(calendar.events ?? []);
        setHolidays(calendar.holidays ?? []);
        setCampaigns(calendar.scheduledCampaigns ?? []);
        setGoogleConfigured(calendar.googleCalendarConfigured === true);
        setGoogleError(calendar.googleCalendarError ?? "");
        setAiEnabled(settings.ai?.enabled === true);
        setAiKeyConfigured(settings.ai?.keyConfigured === true);
        setError("");
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load calendar events.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month]);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of [...events, ...holidays]) {
      const current = grouped.get(event.date) ?? [];
      current.push(event);
      grouped.set(event.date, current);
    }
    return grouped;
  }, [events, holidays]);
  const campaignsByDate = useMemo(() => {
    const grouped = new Map<string, ScheduledCampaign[]>();
    for (const campaign of campaigns) {
      const current = grouped.get(campaign.date) ?? [];
      current.push(campaign);
      grouped.set(campaign.date, current);
    }
    return grouped;
  }, [campaigns]);

  const calendarDays = useMemo(() => {
    const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    return Array.from({ length: 42 }, (_, index) =>
      new Date(month.getFullYear(), month.getMonth(), index - firstWeekday + 1),
    );
  }, [month]);
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const selectedCampaigns = campaignsByDate.get(selectedDate) ?? [];

  function changeMonth(amount: number) {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + amount, 1);
    const day = Math.min(Number(selectedDate.slice(-2)), new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate());
    const nextSelectedDate = dateKey(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day));
    setMonth(nextMonth);
    setSelectedDate(nextSelectedDate);
    setForm((current) => ({ ...current, date: nextSelectedDate }));
    setDraft(null);
    setDraftEvent(null);
  }

  function selectDate(date: Date) {
    const value = dateKey(date);
    if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
    setSelectedDate(value);
    setForm((current) => ({ ...current, date: value }));
    setDraft(null);
    setDraftEvent(null);
  }

  function editEvent(event: CalendarEvent) {
    if (event.source !== "admin") return;
    setEditingId(event.id);
    setForm({
      title: event.title,
      description: event.description,
      date: event.date,
      category: event.category,
    });
    setSelectedDate(event.date);
    setDraft(null);
    setDraftEvent(null);
  }

  function cancelEdit() {
    setEditingId("");
    setForm(emptyForm(selectedDate));
  }

  async function saveEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await apiJson("/api/admin/marketing-calendar", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(editingId ? { id: editingId, event: form } : form),
      });
      if (!result?.ok) throw new Error(result?.message ?? "Unable to save calendar event.");
      setEditingId("");
      setForm(emptyForm(selectedDate));
      setMessage(editingId ? "Calendar event updated." : "Calendar event added.");
      setMonth((current) => new Date(current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save calendar event.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(event: CalendarEvent) {
    if (event.source !== "admin" || !window.confirm(`Delete "${event.title}" from the calendar?`)) return;
    setError("");
    setMessage("");
    try {
      const result = await apiJson("/api/admin/marketing-calendar", {
        method: "DELETE",
        body: JSON.stringify({ id: event.id }),
      });
      if (!result?.ok) throw new Error(result?.message ?? "Unable to delete calendar event.");
      if (editingId === event.id) cancelEdit();
      setMessage("Calendar event deleted.");
      setMonth((current) => new Date(current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete calendar event.");
    }
  }

  async function generateDrafts(event: CalendarEvent) {
    if (!aiEnabled || !aiKeyConfigured) {
      setError("Enable AI and configure VELONA_API_KEY in Admin > Settings to generate campaign drafts.");
      return;
    }
    setGenerating(true);
    setError("");
    setMessage("");
    setDraft(null);
    setDraftEvent(event);
    try {
      const result = await apiJson("/api/admin/marketing-calendar/ai-draft", {
        method: "POST",
        body: JSON.stringify({
          title: event.title,
          date: event.date,
          category: event.category,
          description: event.description,
        }),
      });
      if (!result?.ok) throw new Error(result?.message ?? "Unable to generate campaign drafts.");
      setDraft({ email: result.email, popup: result.popup });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to generate campaign drafts.");
      setDraftEvent(null);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Marketing workspace"
        title="Marketing calendar"
        description="Plan festivals, announcements, and promotions. Google Calendar holidays and admin-created events are shown together; AI can prepare reviewed campaign drafts for either channel."
      />

      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
      {!googleConfigured && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Google holidays are not connected yet. Add <code>GOOGLE_CALENDAR_API_KEY</code> to the backend environment; the default holiday calendar is India.
        </p>
      )}
      {googleError && (
        <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Google Calendar could not load holidays: {googleError}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <AdminSection
          title={monthLabel(month)}
          description="Select a date to review its events and plan a campaign."
          icon={CalendarDays}
          actions={(
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className="grid size-9 place-items-center rounded-lg border border-neutral-200 hover:bg-neutral-50"><ArrowLeft className="size-4" /></button>
              <button type="button" onClick={() => {
                const today = new Date();
                setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                selectDate(today);
              }} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold hover:bg-neutral-50">Today</button>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className="grid size-9 place-items-center rounded-lg border border-neutral-200 hover:bg-neutral-50"><ArrowRight className="size-4" /></button>
            </div>
          )}
        >
          <div className="p-3 sm:p-5">
            <div className="grid grid-cols-7 border-b border-neutral-200 pb-2 text-center text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
            </div>
            {loading ? (
              <div className="grid min-h-72 place-items-center text-sm text-neutral-500"><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />Loading calendar…</span></div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((date) => {
                  const key = dateKey(date);
                  const dayEvents = eventsByDate.get(key) ?? [];
                  const dayCampaigns = campaignsByDate.get(key) ?? [];
                  const dayItems = [
                    ...dayCampaigns.map((campaign) => ({ type: "campaign" as const, item: campaign })),
                    ...dayEvents.map((calendarEvent) => ({ type: "event" as const, item: calendarEvent })),
                  ];
                  const currentMonth = date.getMonth() === month.getMonth();
                  const selected = key === selectedDate;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => selectDate(date)}
                      aria-pressed={selected}
                      aria-label={`${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}${dayItems.length ? `, ${dayItems.length} event${dayItems.length === 1 ? "" : "s"}, including ${dayCampaigns.length} campaign${dayCampaigns.length === 1 ? "" : "s"}` : ""}`}
                      className={`min-h-[76px] border-b border-r border-neutral-100 p-1.5 text-left transition sm:min-h-[94px] sm:p-2 ${
                        selected ? "bg-teal-50 ring-2 ring-inset ring-teal-600" : "hover:bg-neutral-50"
                      } ${currentMonth ? "text-neutral-900" : "text-neutral-300"}`}
                    >
                      <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${key === dateKey(new Date()) ? "bg-teal-700 text-white" : ""}`}>{date.getDate()}</span>
                      <span className="mt-1 grid gap-1">
                        {dayItems.slice(0, 2).map(({ type, item }) => (
                          <span
                            key={`${type}-${item.id}`}
                            className={`truncate rounded border px-1 py-0.5 text-[9px] leading-3 sm:text-[10px] ${
                              type === "campaign"
                                ? item.channel === "email"
                                  ? "border-blue-200 bg-blue-50 text-blue-900"
                                  : "border-rose-200 bg-rose-50 text-rose-900"
                                : eventColor(item)
                            }`}
                          >
                            {type === "campaign" ? `${item.channel === "email" ? "Email" : "Popup"}: ${item.title}` : item.title}
                          </span>
                        ))}
                        {dayItems.length > 2 && <span className="text-[9px] text-neutral-500">+{dayItems.length - 2} more</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-neutral-600">
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-amber-400" />Google holidays</span>
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-orange-500" />Festivals</span>
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-fuchsia-500" />Promotions</span>
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-teal-600" />Admin events</span>
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-blue-600" />Email campaign</span>
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-rose-500" />Popup campaign</span>
            </div>
          </div>
        </AdminSection>

        <div className="grid content-start gap-6">
          <AdminSection title={new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "full" })} description={`${selectedEvents.length} calendar event${selectedEvents.length === 1 ? "" : "s"} · ${selectedCampaigns.length} campaign${selectedCampaigns.length === 1 ? "" : "s"}`}>
            <div className="divide-y divide-neutral-100">
              {selectedEvents.length ? selectedEvents.map((event) => (
                <article key={`${event.source}-${event.id}`} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${eventColor(event)}`}>
                        {event.source === "google" ? "Google holiday" : event.category}
                      </span>
                      <h3 className="mt-2 font-semibold text-neutral-900">{event.title}</h3>
                      {event.description && <p className="mt-1 whitespace-pre-line text-xs leading-5 text-neutral-600">{event.description}</p>}
                    </div>
                    {event.source === "admin" && (
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => editEvent(event)} aria-label={`Edit ${event.title}`} className="grid size-8 place-items-center rounded-lg border border-neutral-200 hover:bg-neutral-50"><Pencil className="size-3.5" /></button>
                        <button type="button" onClick={() => void deleteEvent(event)} aria-label={`Delete ${event.title}`} className="grid size-8 place-items-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"><Trash2 className="size-3.5" /></button>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={generating || !aiEnabled || !aiKeyConfigured || event.date < dateKey(new Date())}
                      onClick={() => void generateDrafts(event)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {generating && draftEvent?.id === event.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      Create AI drafts
                    </button>
                    <Link href={composerUrl("email", event)} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
                      Email composer <ExternalLink className="size-3" />
                    </Link>
                    <Link href={composerUrl("popups", event)} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
                      Popup composer <ExternalLink className="size-3" />
                    </Link>
                  </div>
                </article>
              )) : <p className="p-5 text-sm text-neutral-500">No holiday or admin-created calendar events for this date.</p>}
            </div>
            {draft && draftEvent && (
              <div className="border-t border-violet-100 bg-violet-50/60 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-violet-950"><Check className="size-4" />AI drafts are ready to review</div>
                <p className="mt-1 text-xs leading-5 text-violet-900">Generated copy is only a draft. Review it in the composer, select the audience and schedule, then confirm to create the campaign.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Link href={composerUrl("email", draftEvent, draft)} className="rounded-xl border border-violet-200 bg-white p-3 text-sm font-semibold text-violet-900 hover:bg-violet-50">
                    Email: {draft.email.subject}
                    <span className="mt-1 block line-clamp-2 text-xs font-normal text-neutral-600">{draft.email.body}</span>
                  </Link>
                  <Link href={composerUrl("popups", draftEvent, draft)} className="rounded-xl border border-violet-200 bg-white p-3 text-sm font-semibold text-violet-900 hover:bg-violet-50">
                    Popup: {draft.popup.title}
                    <span className="mt-1 block line-clamp-2 text-xs font-normal text-neutral-600">{draft.popup.message}</span>
                  </Link>
                </div>
              </div>
            )}
            {!aiEnabled || !aiKeyConfigured ? (
              <p className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
                AI drafts need AI enabled and a backend <code>VELONA_API_KEY</code>. Configure AI in <Link className="font-semibold text-teal-800 underline" href="/admin/settings">Admin settings</Link>.
              </p>
            ) : null}
          </AdminSection>

          <AdminSection
            title="Campaigns on this date"
            description="Email and popup campaigns scheduled for, starting on, or completed on this date."
          >
            {selectedCampaigns.length ? (
              <ul className="divide-y divide-neutral-100">
                {selectedCampaigns.map((campaign) => (
                  <li key={`${campaign.channel}-${campaign.id}`} className="flex items-start justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${campaign.channel === "email" ? "bg-blue-50 text-blue-800" : "bg-rose-50 text-rose-800"}`}>
                        {campaign.channel === "email" ? <Mail className="size-4" /> : <Megaphone className="size-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-900">{campaign.title}</p>
                        <p className="mt-1 text-xs capitalize text-neutral-500">
                          {campaign.channel} {campaign.kind} · {new Date(campaign.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </p>
                        {campaign.expiresAt && (
                          <p className="mt-1 text-xs text-neutral-500">Popup ends {new Date(campaign.expiresAt).toLocaleString()}</p>
                        )}
                        <Link href={campaign.channel === "email" ? "/admin/email" : "/admin/popups"} className="mt-2 inline-block text-xs font-semibold text-teal-800 underline">
                          Open {campaign.channel === "email" ? "email" : "popup"} management
                        </Link>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${
                      campaign.status === "scheduled" ? "bg-amber-50 text-amber-800"
                        : campaign.status === "live" || campaign.status === "queued" || campaign.status === "sending" ? "bg-emerald-50 text-emerald-800"
                          : campaign.status === "sent" ? "bg-blue-50 text-blue-800"
                            : campaign.status === "paused" || campaign.status === "partial" ? "bg-neutral-100 text-neutral-700"
                              : "bg-rose-50 text-rose-800"
                    }`}>{campaign.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm text-neutral-500">No email or popup campaigns are scheduled for this date.</p>
            )}
          </AdminSection>

          <AdminSection
            title={editingId ? "Edit calendar event" : "Add calendar event"}
            description="Create a date-specific promotion, announcement, or festival reminder."
            icon={Plus}
            actions={editingId ? <button type="button" onClick={cancelEdit} className="text-xs font-semibold text-neutral-600 hover:text-neutral-900">Cancel edit</button> : undefined}
          >
            <form onSubmit={saveEvent} className="grid gap-3 p-4">
              <label className="text-sm font-semibold text-neutral-800">
                Event name
                <input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Diwali campaign" className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-neutral-800">
                  Date
                  <input required type="date" value={form.date} onChange={(event) => {
                    const value = event.target.value;
                    if (!value) return;
                    setForm({ ...form, date: value });
                    setSelectedDate(value);
                    const [year, month] = value.split("-").map(Number);
                    setMonth(new Date(year, month - 1, 1));
                  }} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-semibold text-neutral-800">
                  Category
                  <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as CalendarCategory })} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
                    <option value="other">Other</option>
                    <option value="festival">Festival</option>
                    <option value="promotion">Promotion</option>
                    <option value="announcement">Announcement</option>
                  </select>
                </label>
              </div>
              <label className="text-sm font-semibold text-neutral-800">
                Notes <span className="font-normal text-neutral-500">(optional)</span>
                <textarea maxLength={1000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Campaign context, offer details, or planning notes" className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" />
              </label>
              <button type="submit" disabled={saving} className="inline-flex w-fit items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60">
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {saving ? "Saving…" : editingId ? "Save event" : "Add event"}
              </button>
            </form>
          </AdminSection>
        </div>
      </div>
    </AppShell>
  );
}
