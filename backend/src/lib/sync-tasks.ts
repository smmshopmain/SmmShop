import { calculateSellingRate } from "@/lib/pricing";
import { dbConnect } from "@/lib/db";
import { syncProviderBalancesAndNotify } from "@/lib/provider-balance";
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
  if (patch.status === "running" && patch.processed === 0 && patch.startedAt === undefined) {
    update.startedAt = new Date();
    update.finishedAt = null;
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

  console.info("[service-sync:diagnostic] provider services parsed", {
    providerName: provider.name,
    serviceCount: services.length,
  });

  await logProviderEvent({
    provider,
    scope: "service_sync",
    action: "fetch_services",
    message: "Provider returned service payload",
    details: { providerName: provider.name, serviceCount: services.length },
  });

  return { services, rawServices };
}

async function syncProvider(
  provider: typeof Provider.prototype,
  settings: Awaited<ReturnType<typeof getSettings>>,
  onProgress?: (processed: number, total: number) => Promise<void>,
) {
  const { services, rawServices } = await fetchProviderServices(provider);
  const uniqueServices = new Map<string, ProviderService>();
  for (const item of services) {
    const id = cleanString(item.service, "");
    if (id) uniqueServices.set(id, item);
  }
  const providerServiceIds = [...uniqueServices.keys()];
  if (providerServiceIds.length === 0) {
    throw new Error(`${provider.name} returned no services with valid identifiers`);
  }

  const categoryNames = [...new Set([...uniqueServices.values()].map((item) => cleanString(item.category, "Uncategorized")))];
  const syncedAt = new Date();
  await Category.bulkWrite(categoryNames.map((name) => ({
    updateOne: {
      filter: { name },
      update: {
        $set: { name, active: true, lastSyncedAt: syncedAt },
        $addToSet: { providers: provider._id },
      },
      upsert: true,
    },
  })));
  const categories = await Category.find({ name: { $in: categoryNames } }).select("_id name").lean();
  const categoryByName = new Map(categories.map((category) => [category.name, category._id]));
  const existingServices = await Service.find({
    provider: provider._id,
    providerServiceId: { $in: providerServiceIds },
  }).select("providerServiceId marginPercent").lean();
  const existingById = new Map(existingServices.map((service) => [service.providerServiceId, service]));
  const defaultMargins = settings.pricing.serviceMargins as Record<string, number>;
  const operations = [...uniqueServices.entries()].map(([providerServiceId, item]) => {
    const categoryName = cleanString(item.category, "Uncategorized");
    const providerRate = toNumber(item.rate, 0);
    const min = toNumber(item.min, 1);
    const max = toNumber(item.max, 100000);
    const existing = existingById.get(providerServiceId);
    const serviceMargins = { ...defaultMargins };
    if (existing?.marginPercent !== undefined && existing.marginPercent !== null) {
      serviceMargins[providerServiceId] = existing.marginPercent;
    }

    return {
      updateOne: {
        filter: { provider: provider._id, providerServiceId },
        update: {
          $set: {
            provider: provider._id,
            providerServiceId,
            name: cleanString(item.name, `Service ${providerServiceId}`),
            categoryRef: categoryByName.get(categoryName),
            category: categoryName,
            type: cleanString(item.type, ""),
            providerRate,
            sellingRate: calculateSellingRate(
              providerRate,
              categoryName,
              providerServiceId,
              existing?.marginPercent !== undefined && existing?.marginPercent !== null
                ? { ...settings.pricing, serviceMargins }
                : settings.pricing,
            ),
            min,
            max,
            refill: parseProviderBoolean(item.refill),
            cancel: parseProviderBoolean(item.cancel),
            active: true,
            lastSyncedAt: syncedAt,
            providerData: item,
          },
        },
        upsert: true,
      },
    };
  });
  let processed = 0;
  const batchSize = 250;
  for (let index = 0; index < operations.length; index += batchSize) {
    const batch = operations.slice(index, index + batchSize);
    const result = await Service.bulkWrite(batch);
    processed += batch.length;
    await onProgress?.(processed, operations.length);
    console.info("[service-sync:diagnostic] service batch upsert complete", {
      providerName: provider.name,
      processed,
      total: operations.length,
      inserted: result.upsertedCount,
      modified: result.modifiedCount,
    });
  }

  const deactivation = await Service.updateMany(
    { provider: provider._id, providerServiceId: { $nin: providerServiceIds }, active: true },
    { active: false, lastSyncedAt: syncedAt },
  );
  const imported = providerServiceIds.filter((id) => !existingById.has(id)).length;
  const updated = providerServiceIds.length - imported;

  provider.lastServiceSyncAt = new Date();
  provider.serviceCache = {
    lastFetchedAt: new Date(),
    serviceCount: providerServiceIds.length,
    raw: rawServices,
  };
  provider.lastError = undefined;
  await provider.save();

  console.info("[service-sync:diagnostic] provider upsert complete", {
    providerName: provider.name,
    imported,
    updated,
    deactivated: deactivation.modifiedCount,
    providerServiceCount: providerServiceIds.length,
    collection: Service.collection.name,
  });

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
  const counts = await Service.aggregate<{ _id: string; serviceCount: number }>([
    { $match: { active: true } },
    { $group: { _id: "$category", serviceCount: { $sum: 1 } } },
  ]);
  const activeCategoryNames = counts.map(({ _id }) => _id);
  const syncedAt = new Date();
  if (counts.length) {
    await Category.bulkWrite(counts.map(({ _id, serviceCount }) => ({
      updateOne: {
        filter: { name: _id },
        update: { $set: { serviceCount, active: true, lastSyncedAt: syncedAt } },
      },
    })));
  }
  await Category.updateMany(
    { name: { $nin: activeCategoryNames }, active: true },
    { active: false, serviceCount: 0, lastSyncedAt: syncedAt },
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
          processed: 0,
          total: 0,
          message: `${title} starting ${provider.name} (${providerProgress}/${totalProviders})`,
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
          await upsertSyncStatus(taskType, {
            status: "running",
            processed: 0,
            total: 0,
            message: `${title} fetching ${provider.name} catalog`,
            details: { providerName: provider.name, providerIndex: providerProgress },
          });
          providerResult = await syncProvider(provider, settings, async (processed, total) => {
            await upsertSyncStatus(taskType, {
              status: "running",
              processed,
              total,
              message: `${title} ${provider.name}: ${processed}/${total} services`,
              details: { providerName: provider.name, providerIndex: providerProgress, serviceCount: total },
            });
          });
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

    const providerErrors = providerResults.filter((item) => item.error);
    await upsertSyncStatus(taskType, {
      status: providerErrors.length ? "failed" : "completed",
      message: providerErrors.length
        ? `${title} finished with ${providerErrors.length} provider error${providerErrors.length === 1 ? "" : "s"}`
        : `${title} completed. Imported ${imported}, updated ${updated}, deactivated ${deactivated}`,
      processed: totalProviders,
      total: totalProviders,
      finishedAt: new Date(),
      details: { imported, updated, deactivated, categoriesSynced, providerResults },
    });

    if (providerErrors.length) {
      throw new Error(
        `${title} failed for ${providerErrors.length} provider${providerErrors.length === 1 ? "" : "s"}: ${
          providerErrors.map((item) => `${item.providerName}: ${item.error}`).join("; ")
        }`,
      );
    }

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
    const total = await Service.countDocuments();

    await upsertSyncStatus("price_sync", {
      status: "running",
      message: `Starting price recalculation for ${total} service${total === 1 ? "" : "s"}`,
      total,
      processed: 0,
      details: { serviceCount: total },
    });

    let updated = 0;
    const configuredBatchSize = Number(process.env.PRICE_SYNC_BATCH_SIZE ?? 250);
    const batchSize = Number.isInteger(configuredBatchSize) && configuredBatchSize > 0
      ? Math.min(configuredBatchSize, 1000)
      : 250;
    const operations: Array<{
      updateOne: {
        filter: { _id: unknown };
        update: { $set: { sellingRate: number } };
      };
    }> = [];

    async function flushBatch() {
      if (operations.length === 0) return;
      await Service.bulkWrite(operations);
      operations.length = 0;
    }

    const cursor = Service.find()
      .select("_id providerRate category providerServiceId marginPercent")
      .lean()
      .cursor({ batchSize });
    for await (const service of cursor) {
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
      operations.push({
        updateOne: {
          filter: { _id: service._id },
          update: { $set: { sellingRate: service.sellingRate } },
        },
      });
      updated += 1;

      if (operations.length >= batchSize) {
        await flushBatch();
        await upsertSyncStatus("price_sync", {
          status: "running",
          processed: updated,
          total,
          message: `Recalculating prices ${updated}/${total} services`,
        });
      }
    }

    await flushBatch();
    if (updated % batchSize !== 0) {
      await upsertSyncStatus("price_sync", {
        status: "running",
        processed: updated,
        total,
        message: `Recalculating prices ${updated}/${total} services`,
      });
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

    let balanceSync: Awaited<ReturnType<typeof syncProviderBalancesAndNotify>> | null = null;
    try {
      balanceSync = await syncProviderBalancesAndNotify();
    } catch (error) {
      console.error("Provider balance check after price recalculation failed.", error);
    }

    return { updated, balanceSync };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Price sync failed";
    await failSyncStatus("price_sync", message, { error });
    throw error;
  }
}

export async function runAutoSync() {
  const errors: string[] = [];
  async function runStep<T>(label: string, task: () => Promise<T>) {
    try {
      return await task();
    } catch (error) {
      const message = error instanceof Error ? error.message : `${label} failed`;
      errors.push(`${label}: ${message}`);
      console.error(`Automatic catalog ${label} failed.`, error);
      return null;
    }
  }

  const importResult = await runStep("service import", serviceImportTask);
  const syncResult = await runStep("service sync", serviceSyncTask);
  const priceResult = await runStep("price recalculation", priceSyncTask);
  return { importResult, syncResult, priceResult, errors };
}
