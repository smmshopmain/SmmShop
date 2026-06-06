import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { serviceSyncTask } from "@/lib/sync-tasks";

export async function GET(request: NextRequest) {
  console.info("[service-sync:diagnostic] request received", {
    origin: request.headers.get("origin"),
    hasCronSecret: Boolean(request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("secret")),
  });

  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  const timeoutMs = Number(process.env.MANUAL_SYNC_TIMEOUT_MS ?? 10000);

  try {
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
      console.info("[service-sync:diagnostic] task still running in background", { timeoutMs });
      return ok({ message: "Service sync started (running in background)" });
    }
    console.info("[service-sync:diagnostic] task completed during request", raced);
    return ok(raced as unknown);
  } catch (error) {
    console.error("[service-sync:diagnostic] task failed", error);
    return fail(error instanceof Error ? error.message : "Service sync failed");
  }
}
