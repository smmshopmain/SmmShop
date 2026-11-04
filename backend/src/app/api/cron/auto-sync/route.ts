import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { runAutoSync } from "@/lib/sync-tasks";

export async function GET(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  try {
    const task = runAutoSync();
    const timeoutMs = Number(process.env.MANUAL_SYNC_TIMEOUT_MS ?? 10000);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), Math.max(1000, timeoutMs));
    });
    const result = await Promise.race([task, timeout]);
    if (timer) clearTimeout(timer);
    if (result === null) {
      void task.then((completed) => {
        if (completed.errors.length) {
          console.error("Automatic catalog refresh finished with errors.", completed.errors);
        } else {
          console.info("Automatic catalog refresh completed.", completed);
        }
      }).catch((error) => {
        console.error("Automatic catalog refresh failed in the background.", error);
      });
      return ok({ started: true, message: "Catalog refresh is running. Poll sync status for progress." }, { status: 202 });
    }
    return ok({ ...result, started: false }, { status: result.errors.length ? 207 : 200 });
  } catch (error) {
    console.error("Automatic catalog refresh failed.", error);
    return fail(error instanceof Error ? error.message : "Automatic sync failed");
  }
}
