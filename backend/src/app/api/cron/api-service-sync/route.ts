import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { dbConnect } from "@/lib/db";
import { ApiRequestLog, ApiServiceMapping, User, getSettings } from "@/models";

export async function GET(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  try {
    await dbConnect();
    const settings = await getSettings();
    if (!settings.api.enabled || !settings.api.autoSyncEnabled) {
      return ok({ disabled: true, processedUsers: 0 });
    }

    const now = new Date();
    const candidates = await User.find({
      apiAccessEnabled: { $ne: false },
      apiAutoSyncEnabled: true,
      isBanned: { $ne: true },
    }).sort({ apiLastSyncAt: 1 }).limit(100).select("_id apiSyncIntervalMinutes apiLastSyncAt");
    let processedUsers = 0;
    let failedUsers = 0;

    for (const candidate of candidates) {
      const interval = Math.max(settings.api.minimumSyncIntervalMinutes, candidate.apiSyncIntervalMinutes ?? 60);
      if (candidate.apiLastSyncAt && now.getTime() - candidate.apiLastSyncAt.getTime() < interval * 60_000) continue;
      const lockUntil = new Date(now.getTime() + 5 * 60_000);
      const lockedUser = await User.findOneAndUpdate(
        {
          _id: candidate._id,
          apiAutoSyncEnabled: true,
          $or: [
            { apiSyncLockUntil: { $exists: false } },
            { apiSyncLockUntil: null },
            { apiSyncLockUntil: { $lte: now } },
          ],
        },
        { $set: { apiSyncLockUntil: lockUntil, apiLastSyncAt: now } },
        { new: true },
      ).select("_id");
      if (!lockedUser) continue;

      try {
        const mappings = await ApiServiceMapping.find({ user: candidate._id }).populate<{
          service: { active: boolean; provider: { enabled: boolean } | null } | null;
        }>({
          path: "service",
          populate: { path: "provider", select: "enabled" },
        });
        for (const mapping of mappings) {
          const available = Boolean(mapping.service?.active && mapping.service.provider?.enabled);
          mapping.status = available ? "active" : "unavailable";
          mapping.lastSyncedAt = now;
          await mapping.save();
        }
        await ApiRequestLog.create({
          user: candidate._id,
          endpoint: "/api/cron/api-service-sync",
          action: "services.auto_sync",
          success: true,
          statusCode: 200,
          durationMs: Date.now() - now.getTime(),
        });
        processedUsers += 1;
      } catch (error) {
        failedUsers += 1;
        console.error("Automatic API service sync failed", {
          userId: String(candidate._id),
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        await ApiRequestLog.create({
          user: candidate._id,
          endpoint: "/api/cron/api-service-sync",
          action: "services.auto_sync",
          success: false,
          statusCode: 500,
          errorCode: "SYNC_FAILED",
          durationMs: Date.now() - now.getTime(),
        });
      } finally {
        await User.updateOne(
          { _id: candidate._id, apiSyncLockUntil: lockUntil },
          { $unset: { apiSyncLockUntil: 1 } },
        );
      }
    }

    return ok({ processedUsers, failedUsers });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Automatic API service sync failed", 500);
  }
}
