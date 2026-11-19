import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { loadGoogleHolidays, type GoogleHolidayResult } from "@/lib/google-holidays";
import {
  ACTIVE_MARKETING_CALENDAR_ITEM_STATUSES,
  IN_FLIGHT_MARKETING_CALENDAR_ITEM_STATUSES,
  startMarketingCalendarScheduleWorker,
} from "@/lib/marketing-calendar-scheduler";
import { AuditLog, EmailCampaign, MarketingCalendarEvent, MarketingCalendarScheduleRun, getSettings } from "@/models";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Choose a valid calendar date.");

const MAX_SCHEDULED_EVENTS = 25;

const requestSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  instructions: z.string().trim().max(2000).default(""),
  eventKeys: z.array(z.string().trim().max(280)
    .regex(/^(?:google|admin):[A-Za-z\d._-]{1,240}:\d{4}-\d{2}-\d{2}$/))
    .min(1)
    .max(MAX_SCHEDULED_EVENTS)
    .refine((keys) => new Set(keys).size === keys.length, "Selected occasions must be unique."),
  generateBanner: z.boolean().default(true),
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

function eventKey(event: { source: "admin" | "google"; id: string; date: string }) {
  return `${event.source}:${event.id}:${event.date}`;
}

function serializeRun(run: {
  _id: unknown;
  startDate: string;
  endDate: string;
  instructions: string;
  generateBanner?: boolean;
  status: string;
  lockUntil?: Date | null;
  items: Array<{
    calendarEventKey: string;
    title: string;
    date: string;
    status: string;
    error?: string;
  }>;
}, canResumeOverride?: boolean) {
  const hasQueuedItems = run.items.some((item: { status: string }) => item.status === "queued");
  const hasInFlightItem = run.items.some((item: { status: string }) =>
    IN_FLIGHT_MARKETING_CALENDAR_ITEM_STATUSES.includes(item.status),
  );
  const lockIsActive = run.lockUntil instanceof Date && run.lockUntil.getTime() > Date.now();
  return {
    id: String(run._id),
    startDate: run.startDate,
    endDate: run.endDate,
    instructions: run.instructions,
    generateBanner: run.generateBanner !== false,
    canResume: canResumeOverride ?? (
      ["queued", "processing"].includes(run.status)
      && hasQueuedItems
      && !hasInFlightItem
      && !lockIsActive
    ),
    status: run.status,
    total: run.items.length,
    scheduled: run.items.filter((item) => item.status === "scheduled").length,
    skipped: run.items.filter((item) => item.status === "skipped").length,
    failed: run.items.filter((item) => item.status === "failed").length,
    events: run.items.map((item) => ({
      calendarEventKey: item.calendarEventKey,
      title: item.title,
      date: item.date,
      status: item.status,
      error: item.error ?? "",
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const requestedId = request.nextUrl.searchParams.get("runId");
    if (requestedId && !idSchema.safeParse(requestedId).success) return fail("Choose a valid scheduling run.", 400);
    const ownerFilter = { createdBy: auth.id };
    const run = requestedId
      ? await MarketingCalendarScheduleRun.findOne({ ...ownerFilter, _id: requestedId }).lean()
      : (await MarketingCalendarScheduleRun.findOne({
          ...ownerFilter,
          status: { $in: ["queued", "processing"] },
        }).sort({ createdAt: -1 }).lean())
        ?? await MarketingCalendarScheduleRun.findOne(ownerFilter).sort({ createdAt: -1 }).lean();
    return ok({ run: run ? serializeRun(run) : null });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load scheduling progress.", 403);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const input = await parseBody(request, requestSchema);
    const [startYear, startMonth, startDay] = input.startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = input.endDate.split("-").map(Number);
    const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
    const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
    if (endUtc < startUtc) return fail("The end date must be on or after the start date.");
    if (endUtc - startUtc > 365 * 24 * 60 * 60 * 1000) {
      return fail("Choose a date range of one year or less.");
    }

    const rangeStart = new Date(startUtc - 330 * 60 * 1000);
    const rangeEnd = new Date(endUtc + 24 * 60 * 60 * 1000 - 330 * 60 * 1000);
    const [adminEvents, holidayResult] = await Promise.all([
      MarketingCalendarEvent.find({ date: { $gte: input.startDate, $lte: input.endDate } })
        .sort({ date: 1, createdAt: -1 })
        .lean(),
      loadGoogleHolidays(rangeStart, rangeEnd).catch((error: unknown): GoogleHolidayResult => ({
        configured: true,
        events: [],
        error: error instanceof Error ? error.message : "Unable to load Google Calendar holidays.",
      })),
    ]);
    if (holidayResult.error) return fail(`Google Calendar holidays could not be loaded: ${holidayResult.error}`, 502);

    const today = indiaDate(new Date());
    const uniqueEvents = new Map<string, {
      calendarEventKey: string;
      eventId: string;
      source: "admin" | "google";
      title: string;
      description: string;
      date: string;
      category: "festival" | "promotion" | "announcement" | "other";
    }>();
    for (const event of adminEvents) {
      const value = {
        eventId: String(event._id),
        source: "admin" as const,
        title: event.title,
        description: event.description ?? "",
        date: event.date,
        category: event.category as "festival" | "promotion" | "announcement" | "other",
      };
      if (value.date >= today) {
        const calendarEventKey = eventKey({ ...value, id: value.eventId });
        uniqueEvents.set(calendarEventKey, { ...value, calendarEventKey });
      }
    }
    for (const event of holidayResult.events) {
      if (event.date >= today) {
        const calendarEventKey = eventKey(event);
        uniqueEvents.set(calendarEventKey, {
          calendarEventKey,
          eventId: event.id,
          source: "google",
          title: event.title,
          description: event.description,
          date: event.date,
          category: event.category,
        });
      }
    }
    if (!uniqueEvents.size) return fail("No upcoming Google holidays or admin events fall in this date range.");

    if (input.eventKeys.some((key) => !uniqueEvents.has(key))) {
      return fail("One or more selected occasions are no longer in this date range. Preview the range again.");
    }
    const selectedKeys = new Set(input.eventKeys);
    const events = [...uniqueEvents.values()].filter((event) => selectedKeys.has(event.calendarEventKey));
    if (!events.length) return fail("Select at least one upcoming occasion.");
    const scheduledCampaigns = await EmailCampaign.find({
      calendarEventKey: { $in: events.map((event) => event.calendarEventKey) },
    }).select("calendarEventKey").lean();
    const alreadyScheduled = new Set(scheduledCampaigns.map((campaign) => campaign.calendarEventKey));
    const pending = events.filter((event) => !alreadyScheduled.has(event.calendarEventKey));
    if (pending.length > MAX_SCHEDULED_EVENTS) {
      return fail(`This range has ${pending.length} unscheduled occasions. Choose a shorter range; one run can schedule at most ${MAX_SCHEDULED_EVENTS}.`);
    }

    const activeRun = pending.length
      ? await MarketingCalendarScheduleRun.exists({
          status: { $in: ["queued", "processing"] },
          items: {
            $elemMatch: {
              calendarEventKey: { $in: pending.map((event) => event.calendarEventKey) },
              status: { $in: ACTIVE_MARKETING_CALENDAR_ITEM_STATUSES },
            },
          },
        })
      : null;
    if (activeRun) return fail("One or more occasions in this range are already being scheduled in the background.", 409);

    const settings = await getSettings();
    if (pending.length && (!settings.ai.enabled || !process.env.VELONA_API_KEY?.trim())) {
      return fail("Enable AI and configure VELONA_API_KEY before starting calendar scheduling.", 400);
    }
    const run = await MarketingCalendarScheduleRun.create({
      createdBy: auth.id,
      startDate: input.startDate,
      endDate: input.endDate,
      instructions: input.instructions,
      brandName: settings.email.brandName,
      generateBanner: input.generateBanner,
      status: pending.length ? "processing" : "completed",
      items: events.map((event) => ({
        ...event,
        status: alreadyScheduled.has(event.calendarEventKey) ? "skipped" : "queued",
        error: alreadyScheduled.has(event.calendarEventKey)
          ? "An email campaign is already scheduled for this occasion."
          : "",
      })),
    });
    await AuditLog.create({
      actor: auth.id,
      action: "marketing_calendar.schedule",
      entity: "MarketingCalendarScheduleRun",
      entityId: String(run._id),
      after: {
        startDate: input.startDate,
        endDate: input.endDate,
        eventCount: events.length,
        generateBanner: input.generateBanner,
        instructions: input.instructions,
      },
    });
    if (pending.length) {
      startMarketingCalendarScheduleWorker("new calendar schedule run", run._id);
    }
    return ok({ run: serializeRun(run, false) }, { status: 202 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to start calendar scheduling.");
  }
}
