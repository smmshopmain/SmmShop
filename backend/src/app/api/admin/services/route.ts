import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { calculateSellingRate } from "@/lib/pricing";
import { AuditLog, Category, getSettings, Service } from "@/models";

const patchSchema = z
  .object({
    id: z.string().min(1).optional(),
    ids: z.array(z.string().min(1)).min(1).max(1000).optional(),
    active: z.boolean().optional(),
    marginPercent: z.number().min(0).max(500).nullable().optional(),
  })
  .refine((input) => input.id || input.ids?.length, "Service id is required");

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const category = searchParams.get("category");
    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (q) filter.$text = { $search: q };

    const [services, categories] = await Promise.all([
      Service.find(filter).populate("provider", "name").sort({ sellingRate: 1, category: 1, name: 1 }).limit(300).lean(),
      Category.find().sort({ name: 1 }).select("name active serviceCount").lean(),
    ]);
    return ok({ services, categories: [...new Set(categories.map((categoryItem) => categoryItem.name))] });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load services", 403);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    const input = patchSchema.parse(await request.json());
    const serviceIds = input.ids ?? (input.id ? [input.id] : []);
    const services = await Service.find({ _id: { $in: serviceIds } });
    if (services.length === 0) return fail("Service not found", 404);
    const settings = input.marginPercent !== undefined ? await getSettings() : null;

    const before = services.map((service) => service.toObject());
    for (const service of services) {
      if (input.active !== undefined) service.active = input.active;
      if (input.marginPercent !== undefined) service.marginPercent = input.marginPercent ?? undefined;
      if (input.marginPercent !== undefined && settings) {
        const serviceMargins: Record<string, number> = { ...settings.pricing.serviceMargins };
        if (input.marginPercent === null) {
          delete serviceMargins[service.providerServiceId];
        } else {
          serviceMargins[service.providerServiceId] = input.marginPercent;
        }
        service.sellingRate = calculateSellingRate(
          service.providerRate,
          service.category,
          service.providerServiceId,
          {
            ...settings.pricing,
            serviceMargins,
          },
        );
      }

      await service.save();
    }

    await AuditLog.create({
      actor: auth.id,
      action: services.length > 1 ? "service.bulk_update" : "service.update",
      entity: "Service",
      entityId: services.length > 1 ? `${services.length} services` : String(services[0]._id),
      before,
      after: services,
    });
    return ok({ services, updated: services.length });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update service");
  }
}
