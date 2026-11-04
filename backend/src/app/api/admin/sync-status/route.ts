import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { dbConnect } from "@/lib/db";
import { SyncStatus } from "@/models";

const STALE_SYNC_MS = 20 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const authError = await requireCronOrAdmin(request);
    if (authError) return authError;
    await dbConnect();
    const staleBefore = new Date(Date.now() - STALE_SYNC_MS);
    await SyncStatus.updateMany(
      { status: "running", updatedAt: { $lt: staleBefore } },
      {
        $set: {
          status: "failed",
          message: "No progress received for 20 minutes. The task may have stopped; run it again and check provider errors.",
          finishedAt: new Date(),
        },
      },
    );
    const statuses = await SyncStatus.find().sort({ updatedAt: -1 }).lean();
    return ok({ statuses });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load sync status", 401);
  }
}
