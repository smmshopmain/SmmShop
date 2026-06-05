import { calculateSellingRate } from "@/lib/pricing";
import { dbConnect } from "@/lib/db";
import {
  ensureDefaultProviderFromEnv,
  logProviderEvent,
  parseProviderBoolean,
  providerRequest,
} from "@/lib/provider";
import { Category, getSettings, Provider, Service, SyncStatus } from "@/models";

type TaskType = "service_import" | "service_sync" | "price_sync";

type ProviderService = Record<string, unknown> & {
  service?: string | number;
  name?: string;
  category?: string;
  type?: string;
  rate?: string | number;
  min?: string | number;
  max?: string | number;
  refill?: unknown;
  cancel?: unknown;
};

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanString(value: unknown, fallback: string) {
  const parsed = String(value ?? "").trim();
  return parsed || fallback;
}

function getServiceArray(value: unknown): ProviderService[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    const nestedKeys = ["data", "services", "items", "result", "response"] as const;
    for (const key of nestedKeys) {
      const child = candidate[key];
      if (Array.isArray(child)) return child as ProviderService[];
      if (child && typeof child === "object") {
        const nested = getServiceArray(child);
        if (Array.isArray(nested) && nested.length > 0) return nested;
      }
    }

    const firstArray = Object.values(candidate).find(Array.isArray);
    if (Array.isArray(firstArray)) return firstArray as ProviderService[];
  }
  return [];
}

async function upsertSyncStatus(
  taskType: TaskType,
  patch: Partial<{
    status: string;
    message: string;
    total: number;
    processed: number;
    details: unknown;
    startedAt: Date | null;
    finishedAt: Date | null;
  }>,
): Promise<Awaited<ReturnType<typeof SyncStatus.findOneAndUpdate>> | null> {
  const update: Record<string, unknown> = { ...patch };
  if (patch.status === "running" && patch.startedAt === undefined) {
    update.startedAt = new Date();
  }
  if (patch.status === "completed" && patch.finishedAt === undefined) {
    update.finishedAt = new Date();
  }
  try {
    await dbConnect();
  } catch (err) {
    console.error("upsertSyncStatus: MongoDB unavailable, skipping SyncStatus write", err);
    return null;
  }

  try {
    return await SyncStatus.findOneAndUpdate(
      { taskType },
      { $set: update },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
  } catch (err) {
    console.error("upsertSyncStatus: write failed", err);
    return null;
  }
}

async function failSyncStatus(taskType: TaskType, message: string, details?: unknown) {
  try {
    await upsertSyncStatus(taskType, {
      status: "failed",
      message,
      finishedAt: new Date(),
      details,
    });
  } catch (err) {
    console.error("failSyncStatus: unable to persist failure status", err);
  }
}

export async function getCurrentSyncStatuses() {
  await dbConnect();
  return SyncStatus.find().sort({ updatedAt: -1 }).lean();
}

async function fetchProviderServices(provider: typeof Provider.prototype) {
  await logProviderEvent({
    provider,
    scope: "service_sync",
    action: "fetch_services",
    message: "Starting provider service fetch",
    details: { providerName: provider.name, apiUrl: provider.apiUrl },
  });

  const rawServices = await providerRequest<ProviderService[]>(provider, { action: "services" });
  const services = getServiceArray(rawServices);
  if (!Array.isArray(services) || services.length === 0) {
    throw new Error(`${provider.name} returned no services`);
  }

  await logProviderEvent({
    provider,
    scope: "service_sync",
    action: "fetch_services",
    message: "Provider returned service payload",
    details: { providerName: provider.name, serviceCount: services.length },
  });

  return { services, rawServices };
}

async function upsertServiceFromProvider(
  provider: typeof Provider.prototype,
  settings: Awaited<ReturnType<typeof getSettings>>,
  item: ProviderService,
) {
  const providerServiceId = cleanString(item.service, "");
  if (!providerServiceId) return null;

  const categoryName = cleanString(item.category, "Uncategorized");
  const providerRate = toNumber(item.rate, 0);
  const min = toNumber(item.min, 1);
  const max = toNumber(item.max, 100000);

  const category = await Category.findOneAndUpdate(
    { name: categoryName },
    {
      $set: {
        name: categoryName,
        active: true,
        lastSyncedAt: new Date(),
      },
      $addToSet: { providers: provider._id },
    },
    { upsert: true, returnDocument: "after" },
  );

  const existing = await Service.findOne({ provider: provider._id, providerServiceId }).select("marginPercent");
  const serviceMargins: Record<string, number> = {
    ...(settings.pricing.serviceMargins as Record<string, number>),
  };
  if (existing?.marginPercent !== undefined && existing?.marginPercent !== null) {
    serviceMargins[providerServiceId] = existing.marginPercent;
  }

  const sellingRate = calculateSellingRate(
    providerRate,
    categoryName,
    providerServiceId,
    existing?.marginPercent !== undefined && existing?.marginPercent !== null
      ? {
          ...settings.pricing,
          serviceMargins,
        }
      : settings.pricing,
  );

  await Service.findOneAndUpdate(
    { provider: provider._id, providerServiceId },
    {
      provider: provider._id,
      providerServiceId,
      name: cleanString(item.name, `Service ${providerServiceId}`),
      categoryRef: category._id,
      category: categoryName,
      type: cleanString(item.type, ""),
      providerRate,
      sellingRate,
      min,
      max,
      refill: parseProviderBoolean(item.refill),
      cancel: parseProviderBoolean(item.cancel),
      active: true,
      lastSyncedAt: new Date(),
      providerData: item,
    },
    { upsert: true, returnDocument: "after" },
  );

  return { providerServiceId, imported: !existing, updated: Boolean(existing) };
}

async function syncProvider(
  provider: typeof Provider.prototype,
  settings: Awaited<ReturnType<typeof getSettings>>,
) {
  const { services, rawServices } = await fetchProviderServices(provider);

  const providerServiceIds: string[] = [];
  let imported = 0;
  let updated = 0;

  for (const item of services) {
    const result = await upsertServiceFromProvider(provider, settings, item);
    if (!result) continue;
    providerServiceIds.push(result.providerServiceId);
    imported += result.imported ? 1 : 0;
    updated += result.updated ? 1 : 0;
  }

  const deactivation = await Service.updateMany(
    {
      provider: provider._id,
      providerServiceId: { $nin: providerServiceIds },
      active: true,
    },
    { active: false, lastSyncedAt: new Date() },
  );

  provider.lastServiceSyncAt = new Date();
  provider.serviceCache = {
    lastFetchedAt: new Date(),
    serviceCount: providerServiceIds.length,
    raw: rawServices,
  };
  provider.lastError = undefined;
  await provider.save();

  await logProviderEvent({
    provider,
    scope: "service_sync",
    action: "services",
    message: `Provider sync complete`,
    details: {
      providerName: provider.name,
      imported,
      updated,
      deactivated: deactivation.modifiedCount,
      serviceCount: providerServiceIds.length,
    },
  });

  return {
    providerName: provider.name,
    imported,
    updated,
    deactivated: deactivation.modifiedCount,
    serviceCount: providerServiceIds.length,
  };
}

async function updateCategoryMetrics() {
  const activeCategoryNames = await Service.distinct("category", { active: true });
  for (const name of activeCategoryNames) {
    const serviceCount = await Service.countDocuments({ category: name, active: true });
    await Category.updateOne({ name }, { serviceCount, active: true, lastSyncedAt: new Date() });
  }
  await Category.updateMany(
    { name: { $nin: activeCategoryNames }, active: true },
    { active: false, serviceCount: 0, lastSyncedAt: new Date() },
  );
  return activeCategoryNames.length;
}

async function runProviderSyncTask(taskType: TaskType, title: string) {
  try {
    const dryRun = process.env.DRY_RUN_SYNC === "1";
    let settings: Awaited<ReturnType<typeof getSettings>>;
    let providers: typeof Provider.prototype[];

    if (dryRun) {
      settings = { pricing: { serviceMargins: {} } } as Awaited<ReturnType<typeof getSettings>>;
      providers = [
        {
          _id: "dryrun",
          name: "DryRunProvider",
          apiUrl: process.env.PROVIDER_API_URL || "",
          apiKey: process.env.PROVIDER_API_KEY || "",
          priority: 1,
        } as unknown as typeof Provider.prototype,
      ];
    } else {
      await dbConnect();
      await ensureDefaultProviderFromEnv();
      settings = await getSettings();
      providers = await Provider.find({ enabled: true }).sort({ priority: 1 });
    }

    const totalProviders = providers.length;

    if (!dryRun) {
      await upsertSyncStatus(taskType, {
        status: "running",
        message: `${title} for ${totalProviders} provider${totalProviders === 1 ? "" : "s"}`,
        total: totalProviders,
        processed: 0,
        details: { providerCount: totalProviders },
      });
    }

    type ProviderSyncResult = {
      providerName: string;
      imported: number;
      updated: number;
      deactivated: number;
      serviceCount: number;
      error?: string;
    };

    const providerResults: ProviderSyncResult[] = [];

    for (const [index, provider] of providers.entries()) {
      const providerProgress = index + 1;
      if (!dryRun) {
        await upsertSyncStatus(taskType, {
          status: "running",
          processed: providerProgress,
          total: totalProviders,
          message: `${title} ${provider.name} (${providerProgress}/${totalProviders})`,
          details: { providerName: provider.name, providerIndex: providerProgress },
        });
      }

      try {
        let providerResult: ProviderSyncResult;
        if (dryRun) {
          const services = [
            { service: "dry-1", name: "Dry Service 1", category: "Dry", rate: 1, min: 1, max: 10 },
            { service: "dry-2", name: "Dry Service 2", category: "Dry", rate: 2, min: 1, max: 10 },
          ];
          providerResult = {
            providerName: provider.name,
            imported: services.length,
            updated: 0,
            deactivated: 0,
            serviceCount: services.length,
          };
        } else {
          providerResult = await syncProvider(provider, settings);
        }
        providerResults.push(providerResult);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Provider sync failed";
        await logProviderEvent({
          provider,
          level: "error",
          scope: "service_sync",
          action: "services",
          message: `Provider sync failed: ${message}`,
          details: { providerName: provider.name },
        });
        await Provider.findByIdAndUpdate(provider._id, { lastError: message });
        providerResults.push({
          providerName: provider.name,
          imported: 0,
          updated: 0,
          deactivated: 0,
          serviceCount: 0,
          error: message,
        });
      }
    }

    const imported = providerResults.reduce((sum, item) => sum + item.imported, 0);
    const updated = providerResults.reduce((sum, item) => sum + item.updated, 0);
    const deactivated = providerResults.reduce((sum, item) => sum + item.deactivated, 0);

    if (dryRun) {
      // In dry-run mode we avoid any further DB writes (categories, final sync status)
      return { imported, updated, deactivated, categoriesSynced: 0, providerResults };
    }

    const categoriesSynced = await updateCategoryMetrics();

    await upsertSyncStatus(taskType, {
      status: "completed",
      message: `${title} completed. Imported ${imported}, updated ${updated}, deactivated ${deactivated}`,
      processed: totalProviders,
      total: totalProviders,
      finishedAt: new Date(),
      details: { imported, updated, deactivated, categoriesSynced, providerResults },
    });

    return { imported, updated, deactivated, categoriesSynced, providerResults };
  } catch (error) {
    const message = error instanceof Error ? error.message : `${title} failed`;
    await failSyncStatus(taskType, message, { error });
    throw error;
  }
}

export async function serviceImportTask() {
  return runProviderSyncTask("service_import", "Service import");
}

export async function serviceSyncTask() {
  return runProviderSyncTask("service_sync", "Service sync");
}

export async function priceSyncTask() {
  try {
    await dbConnect();
    const settings = await getSettings();
    const services = await Service.find().limit(5000);
    const total = services.length;

    await upsertSyncStatus("price_sync", {
      status: "running",
      message: `Starting price recalculation for ${total} service${total === 1 ? "" : "s"}`,
      total,
      processed: 0,
      details: { serviceCount: total },
    });

    let updated = 0;
    const step = Math.max(1, Math.floor(total / 40));

    for (const [index, service] of services.entries()) {
      const serviceMargins: Record<string, number> = {
        ...(settings.pricing.serviceMargins as Record<string, number>),
      };
      if (service.marginPercent !== undefined && service.marginPercent !== null) {
        serviceMargins[service.providerServiceId] = service.marginPercent;
      }

      service.sellingRate = calculateSellingRate(
        service.providerRate,
        service.category,
        service.providerServiceId,
        service.marginPercent !== undefined && service.marginPercent !== null
          ? {
              ...settings.pricing,
              serviceMargins,
            }
          : settings.pricing,
      );
      await service.save();
      updated += 1;

      if (index % step === 0 || index === total - 1) {
        await upsertSyncStatus("price_sync", {
          status: "running",
          processed: index + 1,
          total,
          message: `Recalculating price ${index + 1}/${total}`,
        });
      }
    }

    await logProviderEvent({
      scope: "price_sync",
      action: "recalculate",
      message: `Recalculated ${updated} service prices`,
      details: { updated },
    });

    await upsertSyncStatus("price_sync", {
      status: "completed",
      message: `Recalculated ${updated} service prices`,
      processed: total,
      total,
      finishedAt: new Date(),
      details: { updated },
    });

    return { updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Price sync failed";
    await failSyncStatus("price_sync", message, { error });
    throw error;
  }
}

export async function runAutoSync() {
  const serviceResult = await serviceSyncTask();
  const priceResult = await priceSyncTask();
  return { serviceResult, priceResult };
}
