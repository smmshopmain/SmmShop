import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { dbConnect } from "@/lib/db";
import { calculateSellingRate } from "@/lib/pricing";
import {
  ensureDefaultProviderFromEnv,
  logProviderEvent,
  parseProviderBoolean,
  providerRequest,
} from "@/lib/provider";
import { Category, getSettings, Provider, Service } from "@/models";

type ProviderService = Record<string, unknown> & {
  service?: string | number;
  name?: string;
  category?: string;
  type?: string;
  rate?: string | number;
  min?: string | number;
  max?: string | number;
};

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanString(value: unknown, fallback: string) {
  const parsed = String(value ?? "").trim();
  return parsed || fallback;
}

function normalizeServiceList(value: unknown): ProviderService[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    const arrays = [
      candidate.services,
      candidate.data,
      candidate.result,
      candidate.list,
      candidate.response,
      candidate.payload,
    ];
    for (const maybeArray of arrays) {
      if (Array.isArray(maybeArray)) return maybeArray as ProviderService[];
    }
  }
  return [];
}

export async function GET(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  try {
    await dbConnect();
    await ensureDefaultProviderFromEnv();
    const settings = await getSettings();
    const providers = await Provider.find({ enabled: true }).sort({ priority: 1 });
    let imported = 0;
    let updated = 0;
    let categoriesSynced = 0;

    const errors: string[] = [];
    for (const provider of providers) {
      try {
        await logProviderEvent({
          provider,
          scope: "service_import",
          action: "services",
          message: `Requesting services from provider ${provider.name}`,
        });

        const servicesResponse = await providerRequest<unknown>(provider, { action: "services" });
        const services = normalizeServiceList(servicesResponse);
        if (!Array.isArray(services)) {
          throw new Error(`${provider.name} did not return a services array`);
        }

        await logProviderEvent({
          provider,
          scope: "service_import",
          action: "services",
          message: `Provider ${provider.name} returned ${services.length} items`,
          details: { count: Array.isArray(services) ? services.length : 0 },
        });

        for (const item of services) {
          const providerServiceId = cleanString(
            item.service ?? item.serviceId ?? item.id ?? item.providerServiceId ?? item.service_id ?? item.sid,
            "",
          );
          if (!providerServiceId) continue;

          const categoryName = cleanString(
            item.category ?? item.categoryName ?? item.category_name ?? item.cat ?? item.group,
            "Uncategorized",
          );
          const providerRate = toNumber(
            item.rate ?? item.price ?? item.cost ?? item.providerRate ?? item.provider_charge ?? item.charge,
            0,
          );
          const min = toNumber(
            item.min ?? item.min_order ?? item.min_order_quantity ?? item.minQty ?? item.minqty ?? item.minimum ?? 1,
            1,
          );
          const max = toNumber(
            item.max ?? item.max_order ?? item.max_order_quantity ?? item.maxQty ?? item.maxqty ?? item.maximum ?? 100000,
            100000,
          );

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

          const existing = await Service.findOne({ provider: provider._id, providerServiceId }).select(
            "marginPercent",
          );
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
              name: cleanString(
                item.name ?? item.serviceName ?? item.service_name ?? item.title,
                `Service ${providerServiceId}`,
              ),
              categoryRef: category._id,
              category: categoryName,
              type: cleanString(item.type ?? item.serviceType ?? item.typeName, ""),
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
          if (existing) updated += 1;
          else imported += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Service import failed";
        errors.push(`${provider.name}: ${message}`);
        await Provider.findByIdAndUpdate(provider._id, { lastError: message });
        await logProviderEvent({
          provider,
          level: "error",
          scope: "service_import",
          action: "services",
          message,
          details: { provider: provider._id },
        });
        continue;
      }
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
    if (errors.length && imported + updated === 0) {
      return fail("Service import did not import any services", 500, {
        imported,
        updated,
        categoriesSynced,
        errors,
      });
    }
    return ok({ imported, updated, categoriesSynced, errors: errors.length ? errors : undefined });
  } catch (error) {
    await logProviderEvent({
      level: "error",
      scope: "service_import",
      action: "services",
      message: error instanceof Error ? error.message : "Service import failed",
    });
    return fail(error instanceof Error ? error.message : "Service import failed");
  }
}
