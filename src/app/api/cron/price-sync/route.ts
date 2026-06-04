import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { calculateSellingRate } from "@/lib/pricing";
import { dbConnect } from "@/lib/db";
import { logProviderEvent } from "@/lib/provider";
import { getSettings, Service } from "@/models";

export async function GET(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  try {
    await dbConnect();
    const settings = await getSettings();
    const services = await Service.find().limit(5000);
    let updated = 0;

    for (const service of services) {
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
    }

    await logProviderEvent({
      scope: "price_sync",
      action: "recalculate",
      message: `Recalculated ${updated} service prices`,
      details: { updated },
    });

    return ok({ updated });
  } catch (error) {
    await logProviderEvent({
      level: "error",
      scope: "price_sync",
      action: "recalculate",
      message: error instanceof Error ? error.message : "Price sync failed",
    });
    return fail(error instanceof Error ? error.message : "Price sync failed");
  }
}
