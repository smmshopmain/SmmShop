import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { calculateSellingRate } from "@/lib/pricing";
import { ensureDefaultProviderFromEnv, providerRequest } from "@/lib/provider";
import { getSettings, Provider, Service } from "@/models";

type ProviderService = {
  service: string | number;
  name: string;
  category: string;
  type?: string;
  rate: string | number;
  min: string | number;
  max: string | number;
  refill?: boolean | string;
  cancel?: boolean | string;
};

export async function GET() {
  try {
    await dbConnect();
    await ensureDefaultProviderFromEnv();
    const settings = await getSettings();
    const providers = await Provider.find({ enabled: true }).sort({ priority: 1 });
    let imported = 0;

    for (const provider of providers) {
      const services = await providerRequest<ProviderService[]>(provider, { action: "services" });
      for (const item of services) {
        const providerRate = Number(item.rate);
        const providerServiceId = String(item.service);
        const existing = await Service.findOne({ provider: provider._id, providerServiceId }).select("marginPercent");
        const serviceMargins: Record<string, number> = {
          ...(settings.pricing.serviceMargins as Record<string, number>),
        };
        if (existing?.marginPercent !== undefined && existing?.marginPercent !== null) {
          serviceMargins[providerServiceId] = existing.marginPercent;
        }
        const sellingRate = calculateSellingRate(
          providerRate,
          item.category,
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
            name: item.name,
            category: item.category,
            type: item.type,
            providerRate,
            sellingRate,
            min: Number(item.min),
            max: Number(item.max),
            refill: item.refill === true || item.refill === "1",
            cancel: item.cancel === true || item.cancel === "1",
            active: true,
          },
          { upsert: true, new: true },
        );
        imported += 1;
      }
    }

    return ok({ imported });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Service sync failed");
  }
}
