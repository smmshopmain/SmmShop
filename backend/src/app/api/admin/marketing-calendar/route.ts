import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { loadGoogleHolidays, type GoogleHolidayResult } from "@/lib/google-holidays";
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

function indiaDate(value: Date) {
  const parts = new Map(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value).map(({ type, value: partValue }) => [type, partValue] as const));
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

function calendarEventKey(event: { source: "admin" | "google"; id: string; date: string }) {
  return `${event.source}:${event.id}:${event.date}`;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    let firstDate: string;
    let lastDate: string;
    let rangeStart: Date;
    let rangeEnd: Date;

    if (startDate || endDate) {
      const parsedStart = dateSchema.safeParse(startDate);
      const parsedEnd = dateSchema.safeParse(endDate);
      if (!parsedStart.success || !parsedEnd.success) return fail("Choose a valid start and end date.");
      firstDate = parsedStart.data;
      lastDate = parsedEnd.data;
      const [startYear, startMonth, startDay] = firstDate.split("-").map(Number);
      const [endYear, endMonth, endDay] = lastDate.split("-").map(Number);
      const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
      const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
      if (endUtc < startUtc) return fail("The end date must be on or after the start date.");
      if (endUtc - startUtc > 365 * 24 * 60 * 60 * 1000) {
        return fail("Choose a date range of one year or less.");
      }
      rangeStart = new Date(startUtc - 330 * 60 * 1000);
      rangeEnd = new Date(endUtc + 24 * 60 * 60 * 1000 - 330 * 60 * 1000);
    } else {
      const month = searchParams.get("month") ?? "";
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail("Choose a valid calendar month.");
      const [year, monthNumber] = month.split("-").map(Number);
      firstDate = `${month}-01`;
      lastDate = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
      rangeStart = new Date(Date.UTC(year, monthNumber - 1, 1) - 330 * 60 * 1000);
      rangeEnd = new Date(Date.UTC(year, monthNumber, 1) - 330 * 60 * 1000);
    }

    const [events, holidayResult, emailCampaigns, popups] = await Promise.all([
      MarketingCalendarEvent.find({ date: { $gte: firstDate, $lte: lastDate } })
        .sort({ date: 1, createdAt: -1 })
        .lean(),
      loadGoogleHolidays(rangeStart, rangeEnd).catch((error: unknown): GoogleHolidayResult => ({
        configured: true,
        events: [],
        error: error instanceof Error ? error.message : "Unable to load Google Calendar holidays.",
      })),
      EmailCampaign.find({ scheduledAt: { $gte: rangeStart, $lt: rangeEnd } })
        .select("title kind status scheduledAt calendarEventKey")
        .sort({ scheduledAt: 1 })
        .lean(),
      SitePopup.find({ startsAt: { $gte: rangeStart, $lt: rangeEnd } })
        .select("title kind active startsAt expiresAt")
        .sort({ startsAt: 1 })
        .lean(),
    ]);
    const now = new Date();

    return ok({
      events: events.map((event) => {
        const calendarEvent = { ...event, id: String(event._id), source: "admin" as const };
        return { ...calendarEvent, calendarEventKey: calendarEventKey(calendarEvent) };
      }),
      holidays: holidayResult.events.map((event) => ({
        ...event,
        calendarEventKey: calendarEventKey(event),
      })),
      scheduledCampaigns: [
        ...emailCampaigns.map((campaign) => ({
          id: String(campaign._id),
          channel: "email" as const,
          title: campaign.title,
          kind: campaign.kind,
          status: campaign.status,
          date: indiaDate(campaign.scheduledAt),
          scheduledAt: campaign.scheduledAt,
          calendarEventKey: campaign.calendarEventKey ?? "",
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
