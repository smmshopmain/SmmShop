import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireUser } from "@/lib/api";
import { publicService } from "@/lib/reseller-api";
import { ApiRequestLog, ApiServiceMapping, Order, Provider, Service, getSettings } from "@/models";

const autoSyncSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: z.number().int().min(5).max(10080),
});

export async function GET() {
  try {
    const { auth, dbUser } = await requireUser();
    if (auth.role !== "user") return fail("Reseller API features are available to customer accounts only.", 403);
    const settings = await getSettings();
    if (!settings.api.enabled) return fail("Reseller API is currently disabled.", 503);
    if (dbUser.apiAccessEnabled === false) return fail("API access is disabled for this account.", 403);
    const [requestCount, failedRequests, orderCount, logs, mappings] = await Promise.all([
      ApiRequestLog.countDocuments({ user: auth.id }),
      ApiRequestLog.countDocuments({ user: auth.id, success: false }),
      Order.countDocuments({ user: auth.id, source: "api" }),
      ApiRequestLog.find({ user: auth.id })
        .select("endpoint action success statusCode durationMs createdAt")
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
      ApiServiceMapping.find({ user: auth.id })
        .select("service externalId status")
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean(),
    ]);
    const services = await Service.find({ _id: { $in: mappings.map((mapping) => mapping.service) } })
      .select("name category sellingRate type min max refill cancel active provider")
      .lean();
    const providers = await Provider.find({ _id: { $in: services.map((service) => service.provider) } })
      .select("enabled")
      .lean();
    const serviceById = new Map(services.map((service) => [String(service._id), service]));
    const enabledProviderIds = new Set(
      providers.filter((provider) => provider.enabled).map((provider) => String(provider._id)),
    );
    const hasUserDiscountOverride = settings.api.allowUserDiscountOverrides &&
      typeof dbUser.apiDiscountPercent === "number";
    const discount = settings.api.discountEnabled
      ? hasUserDiscountOverride
        ? Math.max(0, Math.min(100, dbUser.apiDiscountPercent))
        : Math.max(0, Math.min(100, settings.api.discountPercent))
      : 0;
    return ok({
      protocols: {
        restEnabled: settings.api.restEnabled,
        standardEnabled: settings.api.standardEnabled,
        requireVersionHeader: settings.api.requireVersionHeader,
      },
      usage: { requests: requestCount, failedRequests, orders: orderCount },
      pricing: {
        discountEnabled: settings.api.discountEnabled,
        discountPercent: discount,
        discountSource: settings.api.discountEnabled
          ? hasUserDiscountOverride ? "account" : "platform"
          : "none",
      },
      security: {
        allowlistEnforced: settings.api.enforceIpAllowlist,
        allowedIps: dbUser.apiAllowedIps ?? [],
      },
      sync: {
        available: settings.api.autoSyncEnabled,
        minimumIntervalMinutes: settings.api.minimumSyncIntervalMinutes,
        enabled: dbUser.apiAutoSyncEnabled === true,
        intervalMinutes: dbUser.apiSyncIntervalMinutes ?? 60,
        lastSyncAt: dbUser.apiLastSyncAt ?? null,
        nextSyncAt: dbUser.apiAutoSyncEnabled
          ? new Date((dbUser.apiLastSyncAt?.getTime() ?? Date.now()) + (dbUser.apiSyncIntervalMinutes ?? 60) * 60_000)
          : null,
      },
      logs,
      importedServices: mappings.map((mapping) => {
        const service = serviceById.get(String(mapping.service));
        const serviceAvailable = Boolean(service?.active && enabledProviderIds.has(String(service.provider)));
        return {
          externalId: mapping.externalId,
          status: serviceAvailable ? mapping.status : "unavailable",
          service: service
            ? publicService({
                _id: service._id,
                name: service.name,
                category: service.category,
                sellingRate: service.sellingRate,
                min: service.min,
                max: service.max,
                refill: service.refill,
                cancel: service.cancel,
                type: service.type,
              }, discount)
            : null,
        };
      }),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load API usage", 401);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth, dbUser } = await requireUser();
    if (auth.role !== "user") return fail("Reseller API features are available to customer accounts only.", 403);
    const settings = await getSettings();
    if (!settings.api.enabled) return fail("Reseller API is currently disabled.", 503);
    if (dbUser.apiAccessEnabled === false) return fail("API access is disabled for this account.", 403);
    if (!settings.api.autoSyncEnabled) return fail("Automatic service synchronization is disabled by the administrator.", 403);
    const input = autoSyncSchema.parse(await request.json());
    if (input.intervalMinutes < settings.api.minimumSyncIntervalMinutes) {
      return fail(`Sync interval must be at least ${settings.api.minimumSyncIntervalMinutes} minutes.`, 400);
    }
    dbUser.apiAutoSyncEnabled = input.enabled;
    dbUser.apiSyncIntervalMinutes = input.intervalMinutes;
    await dbUser.save();
    return ok({
      enabled: dbUser.apiAutoSyncEnabled,
      intervalMinutes: dbUser.apiSyncIntervalMinutes,
      lastSyncAt: dbUser.apiLastSyncAt ?? null,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update API sync settings");
  }
}

export async function POST() {
  const startedAt = Date.now();
  let userId: string | null = null;
  try {
    const { auth, dbUser } = await requireUser();
    userId = auth.id;
    if (auth.role !== "user") return fail("Reseller API features are available to customer accounts only.", 403);
    const settings = await getSettings();
    if (!settings.api.enabled) return fail("Reseller API is currently disabled.", 503);
    if (dbUser.apiAccessEnabled === false) return fail("API access is disabled for this account.", 403);
    if (!settings.api.manualSyncEnabled) return fail("Manual service synchronization is disabled.", 403);

    const mappings = await ApiServiceMapping.find({ user: auth.id }).select("service status");
    const services = await Service.find({ _id: { $in: mappings.map((mapping) => mapping.service) } })
      .select("active provider")
      .lean();
    const providers = await Provider.find({ _id: { $in: services.map((service) => service.provider) } })
      .select("enabled")
      .lean();
    const serviceById = new Map(services.map((service) => [String(service._id), service]));
    const enabledProviderIds = new Set(
      providers.filter((provider) => provider.enabled).map((provider) => String(provider._id)),
    );
    let active = 0;
    let unavailable = 0;
    for (const mapping of mappings) {
      const service = serviceById.get(String(mapping.service));
      const available = Boolean(service?.active && enabledProviderIds.has(String(service.provider)));
      mapping.status = available ? "active" : "unavailable";
      mapping.lastSyncedAt = new Date();
      await mapping.save();
      if (available) active += 1;
      else unavailable += 1;
    }
    await ApiRequestLog.create({
      user: auth.id,
      endpoint: "/api/account/api-usage",
      action: "services.manual_sync",
      success: true,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    });
    return ok({ mappings: mappings.length, active, unavailable, syncedAt: new Date().toISOString() });
  } catch (error) {
    if (userId) {
      try {
        await ApiRequestLog.create({
          user: userId,
          endpoint: "/api/account/api-usage",
          action: "services.manual_sync",
          success: false,
          statusCode: 500,
          errorCode: "SYNC_FAILED",
          durationMs: Date.now() - startedAt,
        });
      } catch (logError) {
        console.error("Manual API service sync failure could not be logged", {
          errorName: logError instanceof Error ? logError.name : "UnknownError",
        });
      }
    }
    return fail(error instanceof Error ? error.message : "Unable to synchronize API services");
  }
}
