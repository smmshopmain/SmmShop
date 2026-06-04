import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { dbConnect } from "@/lib/db";
import {
  getProviderRefillStatus,
  logProviderEvent,
  normalizeProviderRefillStatus,
} from "@/lib/provider";
import { Refill } from "@/models";

export async function GET(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  try {
    await dbConnect();
    const activeRefills = await Refill.find({
      status: { $in: ["Pending", "Processing"] },
      providerRefillId: { $exists: true },
    })
      .populate("provider")
      .limit(100);

    let refillsSynced = 0;
    for (const refill of activeRefills) {
      try {
        const result = await getProviderRefillStatus(refill.provider, String(refill.providerRefillId));
        const normalizedStatus = normalizeProviderRefillStatus(result.status);
        if (normalizedStatus) refill.status = normalizedStatus;
        refill.lastStatusSyncAt = new Date();
        refill.providerResponse = { ...(refill.providerResponse ?? {}), lastStatus: result };
        await refill.save();
        refillsSynced += 1;
      } catch (error) {
        await logProviderEvent({
          provider: refill.provider,
          level: "error",
          scope: "refill_sync",
          action: "refill_status",
          message: error instanceof Error ? error.message : "Refill sync failed",
          details: { refill: refill.providerRefillId },
        });
      }
    }

    await logProviderEvent({
      scope: "refill_sync",
      action: "refill_status",
      message: `Synced ${refillsSynced} refills`,
      details: { refillsSynced },
    });

    return ok({ refillsSynced });
  } catch (error) {
    await logProviderEvent({
      level: "error",
      scope: "refill_sync",
      action: "refill_status",
      message: error instanceof Error ? error.message : "Refill sync failed",
    });
    return fail(error instanceof Error ? error.message : "Refill sync failed");
  }
}
