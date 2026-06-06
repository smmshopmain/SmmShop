import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { serviceImportTask } from "@/lib/sync-tasks";

export async function GET(request: NextRequest) {
  console.info("[service-import:diagnostic] request received", {
    origin: request.headers.get("origin"),
    hasCronSecret: Boolean(request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("secret")),
  });

  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  // Run the import but don't let the HTTP request hang. If the task
  // doesn't finish within `timeoutMs`, return a 202 and continue
  // running the task in background.
  const timeoutMs = Number(process.env.MANUAL_SYNC_TIMEOUT_MS ?? 10000);

  try {
    const taskPromise = serviceImportTask();
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const raced = await Promise.race([taskPromise, timeoutPromise]);
    if (raced === null) {
      void (async () => {
        try {
          await taskPromise;
        } catch (err) {
          console.error("Background serviceImportTask failed:", err);
        }
      })();
      console.info("[service-import:diagnostic] task still running in background", { timeoutMs });
      return ok({ message: "Service import started (running in background)" });
    }
    console.info("[service-import:diagnostic] task completed during request", raced);
    return ok(raced as unknown);
  } catch (error) {
    console.error("[service-import:diagnostic] task failed", error);
    return fail(error instanceof Error ? error.message : "Service import failed");
  }
}
