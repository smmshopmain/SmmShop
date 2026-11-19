import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { AuditLog, EmailCampaign, MarketingCalendarEvent, SitePopup } from "@/models";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Choose a valid calendar date.");

const eventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  date: dateSchema,
  category: z.enum(["festival", "promotion", "announcement", "other"]).default("other"),
}).strict();

const idSchema = z.string().regex(/^[a-f\d]{24}$/i);
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars";

type GoogleHolidayResult = {
  configured: boolean;
  events: Array<{
    id: string;
    title: string;
    description: string;
    date: string;
    category: "festival";
    source: "google";
  }>;
  error?: string;
};

function googleEventDate(event: { start?: { date?: string; dateTime?: string } }) {
  return event.start?.date ?? event.start?.dateTime?.slice(0, 10) ?? "";
}

function indiaDate(value: Date) {
  const parts = new Map(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value).map(({ type, value: partValue }) => [type, partValue] as const));
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

async function loadGoogleHolidays(monthStart: Date, monthEnd: Date): Promise<GoogleHolidayResult> {
  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY?.trim();
  if (!apiKey) return { configured: false as const, events: [] };

  const calendarId = process.env.GOOGLE_HOLIDAY_CALENDAR_ID?.trim()
    || "en.indian#holiday@group.v.calendar.google.com";
  const url = new URL(`${GOOGLE_CALENDAR_API}/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("timeMin", monthStart.toISOString());
  url.searchParams.set("timeMax", monthEnd.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("timeZone", "Asia/Kolkata");

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const result = await response.json() as {
    items?: Array<{
      id?: string;
      summary?: string;
      description?: string;
      start?: { date?: string; dateTime?: string };
      end?: { date?: string; dateTime?: string };
    }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(result.error?.message || `Google Calendar returned status ${response.status}.`);
  }

  return {
    configured: true as const,
    events: (result.items ?? []).flatMap((event) => {
      const date = googleEventDate(event);
      if (!event.id || !event.summary || !date) return [];
      return [{
        id: event.id,
        title: event.summary.slice(0, 120),
        description: (event.description ?? "").slice(0, 1000),
        date,
        category: "festival" as const,
        source: "google" as const,
      }];
    }),
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();
    const month = request.nextUrl.searchParams.get("month") ?? "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail("Choose a valid calendar month.");

    const [year, monthNumber] = month.split("-").map(Number);
    const nextMonthStart = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
    const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1) - 330 * 60 * 1000);
    const monthEnd = new Date(Date.UTC(year, monthNumber, 1) - 330 * 60 * 1000);
    const [events, holidayResult, emailCampaigns, popups] = await Promise.all([
      MarketingCalendarEvent.find({ date: { $gte: `${month}-01`, $lt: nextMonthStart } })
        .sort({ date: 1, createdAt: -1 })
        .lean(),
      loadGoogleHolidays(monthStart, monthEnd).catch((error: unknown): GoogleHolidayResult => ({
        configured: true,
        events: [],
        error: error instanceof Error ? error.message : "Unable to load Google Calendar holidays.",
      })),
      EmailCampaign.find({ scheduledAt: { $gte: monthStart, $lt: monthEnd } })
        .select("title kind status scheduledAt")
        .sort({ scheduledAt: 1 })
        .lean(),
      SitePopup.find({ startsAt: { $gte: monthStart, $lt: monthEnd } })
        .select("title kind active startsAt expiresAt")
        .sort({ startsAt: 1 })
        .lean(),
    ]);
    const now = new Date();

    return ok({
      events: events.map((event) => ({ ...event, id: String(event._id), source: "admin" as const })),
      holidays: holidayResult.events,
      scheduledCampaigns: [
        ...emailCampaigns.map((campaign) => ({
          id: String(campaign._id),
          channel: "email" as const,
          title: campaign.title,
          kind: campaign.kind,
          status: campaign.status,
          date: indiaDate(campaign.scheduledAt),
          scheduledAt: campaign.scheduledAt,
        })),
        ...popups.map((popup) => ({
          id: String(popup._id),
          channel: "popup" as const,
          title: popup.title || "Image-only popup",
          kind: popup.kind,
          status: !popup.active
            ? "paused"
            : popup.expiresAt <= now
              ? "expired"
              : popup.startsAt > now
                ? "scheduled"
                : "live",
          date: indiaDate(popup.startsAt),
          scheduledAt: popup.startsAt,
          expiresAt: popup.expiresAt,
        })),
      ],
      googleCalendarConfigured: holidayResult.configured,
      ...(holidayResult.error ? { googleCalendarError: holidayResult.error } : {}),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load the marketing calendar", 403);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const input = eventSchema.parse(await request.json());
    const event = await MarketingCalendarEvent.create({ ...input, createdBy: auth.id });
    await AuditLog.create({
      actor: auth.id,
      action: "marketing_calendar.create",
      entity: "MarketingCalendarEvent",
      entityId: String(event._id),
      after: event,
    });
    return ok({ event });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create calendar event");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const body = await request.json() as Record<string, unknown>;
    const id = idSchema.parse(body.id);
    const input = eventSchema.parse(body.event);
    const before = await MarketingCalendarEvent.findById(id).lean();
    if (!before) return fail("Calendar event not found.", 404);
    const event = await MarketingCalendarEvent.findByIdAndUpdate(id, input, { new: true, runValidators: true });
    if (!event) return fail("Calendar event not found.", 404);
    await AuditLog.create({
      actor: auth.id,
      action: "marketing_calendar.update",
      entity: "MarketingCalendarEvent",
      entityId: id,
      before,
      after: event,
    });
    return ok({ event });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update calendar event");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const body = await request.json() as { id?: unknown };
    const id = idSchema.parse(body.id);
    const event = await MarketingCalendarEvent.findById(id).lean();
    if (!event) return fail("Calendar event not found.", 404);
    await MarketingCalendarEvent.deleteOne({ _id: id });
    await AuditLog.create({
      actor: auth.id,
      action: "marketing_calendar.delete",
      entity: "MarketingCalendarEvent",
      entityId: id,
      before: event,
    });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to delete calendar event");
  }
}
