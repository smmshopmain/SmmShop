import { NextRequest } from "next/server";
import { ResellerApiError, runResellerApiRequest } from "@/lib/reseller-api";
import { ApiServiceMapping } from "@/models";

export async function POST(request: NextRequest) {
  return runResellerApiRequest(request, "rest", {}, "services.sync", async (context) => {
    if (!context.settings.api.manualSyncEnabled) {
      throw new ResellerApiError("SYNC_DISABLED", "Manual service synchronization is disabled.", 403);
    }

    const mappings = await ApiServiceMapping.find({ user: context.user._id }).populate<{
      service: { active: boolean; provider: { enabled: boolean } | null } | null;
    }>({
      path: "service",
      populate: { path: "provider", select: "enabled" },
    });
    let active = 0;
    let unavailable = 0;
    for (const mapping of mappings) {
      const service = mapping.service;
      const available = Boolean(service?.active && service.provider?.enabled);
      mapping.status = available ? "active" : "unavailable";
      mapping.lastSyncedAt = new Date();
      await mapping.save();
      if (available) active += 1;
      else unavailable += 1;
    }
    return { mappings: mappings.length, active, unavailable, syncedAt: new Date().toISOString() };
  });
}
