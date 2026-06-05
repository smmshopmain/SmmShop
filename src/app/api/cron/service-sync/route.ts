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
    let deactivated = 0;

    for (const provider of providers) {
      const services = await providerRequest<ProviderService[]>(provider, { action: "services" });
      if (!Array.isArray(services)) {
        throw new Error(`${provider.name} did not return a services array`);
      }

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
        if (existing) updated += 1;
        else imported += 1;
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

      provider.lastError = undefined;
      await provider.save();
      await logProviderEvent({
        provider,
        scope: "service_sync",
        action: "services",
        message: `Synced ${services.length} provider services`,
        details: { imported, updated, deactivated, categoriesSynced },
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

    return ok({ imported, updated, deactivated, categoriesSynced });
  } catch (error) {
    await logProviderEvent({
      level: "error",
      scope: "service_sync",
      action: "services",
      message: error instanceof Error ? error.message : "Service sync failed",
    });
    return fail(error instanceof Error ? error.message : "Service sync failed");
  }
}
