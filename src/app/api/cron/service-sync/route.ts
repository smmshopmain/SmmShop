import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { serviceSyncTask } from "@/lib/sync-tasks";

export async function GET(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  const timeoutMs = Number(process.env.MANUAL_SYNC_TIMEOUT_MS ?? 10000);
  const taskPromise = serviceSyncTask();
  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));

  const raced = await Promise.race([taskPromise, timeoutPromise]);
  if (raced === null) {
    void (async () => {
      try {
        await taskPromise;
      } catch (err) {
        console.error("Background serviceSyncTask failed:", err);
      }
    })();
    return ok({ message: "Service sync started (running in background)" });
  }

  try {
    return ok(raced as unknown);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Service sync failed");
  }
}
