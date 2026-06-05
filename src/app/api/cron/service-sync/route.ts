import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { serviceSyncTask } from "@/lib/sync-tasks";

export async function GET(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  try {
    const result = await serviceSyncTask();
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Service sync failed");
  }
}
