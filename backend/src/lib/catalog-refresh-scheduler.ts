import { dbConnect } from "@/lib/db";
import { runAutoSync } from "@/lib/sync-tasks";
import { isCatalogRefreshDue } from "@/lib/catalog-refresh-time";
import { CatalogRefreshScheduleRun, getSettings } from "@/models";

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

export async function startCatalogRefreshIfDue(now = new Date()) {
  await dbConnect();
  const { catalogSync } = await getSettings();
  if (!catalogSync.dailyRefreshEnabled) return { started: false, reason: "disabled" as const };

  const localSchedule = isCatalogRefreshDue(now, catalogSync.dailyRefreshTime);
  if (!localSchedule.due) {
    return { started: false, reason: "not-due" as const };
  }

  let scheduledRun;
  try {
    scheduledRun = await CatalogRefreshScheduleRun.create({
      localDate: localSchedule.date,
      scheduledTime: catalogSync.dailyRefreshTime,
      status: "running",
      message: "Starting daily service import, sync, and price recalculation.",
      startedAt: now,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) return { started: false, reason: "already-started" as const };
    throw error;
  }

  void (async () => {
    try {
      const result = await runAutoSync();
      const failed = result.errors.length > 0;
      await CatalogRefreshScheduleRun.updateOne(
        { _id: scheduledRun._id },
        {
          $set: {
            status: failed ? "failed" : "completed",
            message: failed
              ? `Daily catalog refresh finished with errors: ${result.errors.join("; ")}`
              : "Daily service import, sync, and price recalculation completed.",
            finishedAt: new Date(),
          },
        },
      );
      if (failed) console.error("Daily catalog refresh finished with errors.", result.errors);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Daily catalog refresh failed.";
      try {
        await CatalogRefreshScheduleRun.updateOne(
          { _id: scheduledRun._id },
          { $set: { status: "failed", message, finishedAt: new Date() } },
        );
      } catch (updateError) {
        console.error("Unable to persist daily catalog refresh failure.", updateError);
      }
      console.error("Daily catalog refresh failed.", error);
    }
  })();

  return {
    started: true,
    runId: String(scheduledRun._id),
    localDate: localSchedule.date,
    scheduledTime: catalogSync.dailyRefreshTime,
    timeZone: "Asia/Kolkata",
  };
}
