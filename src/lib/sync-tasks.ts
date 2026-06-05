import { calculateSellingRate } from "@/lib/pricing";
import { dbConnect } from "@/lib/db";
import {
  ensureDefaultProviderFromEnv,
  logProviderEvent,
  parseProviderBoolean,
  providerRequest,
} from "@/lib/provider";
import { Category, getSettings, Provider, Service, SyncStatus } from "@/models";

type TaskType = "service_sync" | "price_sync";

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

async function upsertSyncStatus(taskType: TaskType, patch: Partial<{
  status: string;
  message: string;
  total: number;
  processed: number;
  details: unknown;
  startedAt: Date | null;
  finishedAt: Date | null;
}>) {
  const update: Record<string, unknown> = { ...patch };
  if (patch.status === "running" && patch.startedAt === undefined) {
    update.startedAt = new Date();
  }
  if (patch.status === "completed" && patch.finishedAt === undefined) {
    update.finishedAt = new Date();
  }
  return SyncStatus.findOneAndUpdate(
    { taskType },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function failSyncStatus(taskType: TaskType, message: string, details?: unknown) {
  await upsertSyncStatus(taskType, {
    status: "failed",
    message,
    finishedAt: new Date(),
    details,
  });
}

export async function getCurrentSyncStatuses() {
  await dbConnect();
  return SyncStatus.find().sort({ updatedAt: -1 }).lean();
}

export async function serviceSyncTask() {
  try {
    await dbConnect();
    await ensureDefaultProviderFromEnv();
    const settings = await getSettings();
    const providers = await Provider.find({ enabled: true }).sort({ priority: 1 });
    const totalProviders = providers.length;

    await upsertSyncStatus("service_sync", {
      status: "running",
      message: `Starting service import for ${totalProviders} provider${totalProviders === 1 ? "" : "s"}`,
      total: totalProviders,
      processed: 0,
      details: { providerCount: totalProviders },
    });

    let imported = 0;
    let updated = 0;
    let deactivated = 0;
    let categoriesSynced = 0;

    for (const [index, provider] of providers.entries()) {
    const providerProgress = index + 1;
    await upsertSyncStatus("service_sync", {
      processed: providerProgress,
      total: totalProviders,
      status: "running",
      message: `Syncing services from ${provider.name} (${providerProgress}/${totalProviders})`,
      details: { providerName: provider.name, providerIndex: providerProgress },
    });

    // per-provider counters for more detailed logging
    let providerImported = 0;
    let providerUpdated = 0;

    await logProviderEvent({
      provider,
      scope: "service_sync",
      action: "services",
      message: `Requesting services list from provider`,
      details: { provider: provider.name },
    });

    const rawServices = await providerRequest<ProviderService[]>(provider, { action: "services" });
    const services = getServiceArray(rawServices);
    if (!Array.isArray(services) || services.length === 0) {
      throw new Error(`${provider.name} did not return a services array`);
    }

    await logProviderEvent({
      provider,
      scope: "service_sync",
      action: "services",
      message: `Provider returned services`,
      details: { provider: provider.name, providerServiceCount: services.length },
    });

    const providerServiceIds: string[] = [];
    for (const item of services) {
      const providerServiceId = cleanString(item.service, "");
      if (!providerServiceId) continue;

      const categoryName = cleanString(item.category, "Uncategorized");
      const providerRate = toNumber(item.rate, 0);
      const min = toNumber(item.min, 1);
      const max = toNumber(item.max, 100000);
      providerServiceIds.push(providerServiceId);

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
        { upsert: true, new: true },
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
        { upsert: true, new: true },
      );

      if (existing) {
        updated += 1;
        providerUpdated += 1;
      } else {
        imported += 1;
        providerImported += 1;
        await logProviderEvent({
          provider,
          scope: "service_sync",
          action: "service_import",
          message: `Imported service ${providerServiceId}`,
          details: { providerServiceId, name: item.name ?? item.service ?? null },
        });
      }
    }

    const deactivateResult = await Service.updateMany(
      {
        provider: provider._id,
        providerServiceId: { $nin: providerServiceIds },
        active: true,
      },
      { active: false, lastSyncedAt: new Date() },
    );
    deactivated += deactivateResult.modifiedCount;

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
      message: `Synced ${providerServiceIds.length} services from ${provider.name}`,
      details: { providerServiceCount: providerServiceIds.length, imported: providerImported, updated: providerUpdated, deactivated: deactivated },
    });
  }

  const activeCategoryNames = await Service.distinct("category", { active: true });
  for (const name of activeCategoryNames) {
    const serviceCount = await Service.countDocuments({ category: name, active: true });
    await Category.updateOne({ name }, { serviceCount, active: true, lastSyncedAt: new Date() });
  }
  await Category.updateMany(
    { name: { $nin: activeCategoryNames }, active: true },
    { active: false, serviceCount: 0, lastSyncedAt: new Date() },
  );
  categoriesSynced = activeCategoryNames.length;

    await upsertSyncStatus("service_sync", {
      status: "completed",
      message: `Imported ${imported} services, updated ${updated}, deactivated ${deactivated}`,
      processed: totalProviders,
      total: totalProviders,
      finishedAt: new Date(),
      details: { imported, updated, deactivated, categoriesSynced },
    });

    return { imported, updated, deactivated, categoriesSynced };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Service sync failed";
    await failSyncStatus("service_sync", message, { error });
    throw error;
  }
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
