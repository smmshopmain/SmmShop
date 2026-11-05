import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { dbConnect } from "@/lib/db";
import { logProviderEvent } from "@/lib/provider";
import { syncProviderBalancesAndNotify } from "@/lib/provider-balance";
import { notifyTelegram } from "@/lib/telegram";

export async function GET(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  try {
    await dbConnect();
    const result = await syncProviderBalancesAndNotify();
    return ok(result, { status: result.failed ? 207 : 200 });
  } catch (error) {
    await logProviderEvent({
      level: "error",
      scope: "provider_balance",
      action: "balance",
      message: error instanceof Error ? error.message : "Provider balance sync failed",
    });
    await notifyTelegram("Provider Errors", [error instanceof Error ? error.message : "Unknown error"]);
    return fail(error instanceof Error ? error.message : "Provider balance sync failed");
  }
}
