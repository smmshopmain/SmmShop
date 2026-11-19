import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import {
  ACTIVE_MARKETING_CALENDAR_ITEM_STATUSES,
  startMarketingCalendarScheduleWorker,
} from "@/lib/marketing-calendar-scheduler";
import { AuditLog, MarketingCalendarScheduleRun } from "@/models";

const requestSchema = z.object({
  runId: z.string().regex(/^[a-f\d]{24}$/i),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const { runId } = await parseBody(request, requestSchema);
    const now = new Date();
    const started = await MarketingCalendarScheduleRun.updateOne(
      {
        _id: runId,
        createdBy: auth.id,
        status: { $in: ["queued", "processing"] },
        "items.status": { $in: ACTIVE_MARKETING_CALENDAR_ITEM_STATUSES },
        $or: [
          { lockUntil: { $exists: false } },
          { lockUntil: null },
          { lockUntil: { $lte: now } },
        ],
      },
      { $set: { status: "processing", lockUntil: null } },
    );
    if (!started.matchedCount) {
      return fail("There are no queued schedules to start, or the worker is already processing them.", 409);
    }

    await AuditLog.create({
      actor: auth.id,
      action: "marketing_calendar.resume_schedule",
      entity: "MarketingCalendarScheduleRun",
      entityId: runId,
    });
    startMarketingCalendarScheduleWorker("admin resumed queued calendar schedules", runId);
    return ok({ runId, status: "processing" }, { status: 202 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to resume calendar scheduling.", 403);
  }
}
