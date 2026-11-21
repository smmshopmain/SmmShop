import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { getApiDiscount, publicService, readApiInput, ResellerApiError, runResellerApiRequest } from "@/lib/reseller-api";
import { ApiServiceMapping, Service } from "@/models";

const inputSchema = z.object({
  serviceIds: z.array(z.string().min(1).max(80)).max(500).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  all: z.boolean().optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(500).optional(),
}).refine((value) => Boolean(value.all || value.category || value.serviceIds?.length), "Choose all services, a category, or selected service IDs.");

export async function POST(request: NextRequest) {
  let input: Record<string, unknown>;
  try {
    input = await readApiInput(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid API request.";
    return Response.json({ success: false, error: { code: "INVALID_REQUEST", message } }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({
      success: false,
      error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid service selection." },
    }, { status: 400 });
  }
  if (parsed.data.serviceIds?.some((id) => !mongoose.isValidObjectId(id))) {
    return Response.json({
      success: false,
      error: { code: "INVALID_SERVICE_ID", message: "One or more service IDs are invalid." },
    }, { status: 400 });
  }

  return runResellerApiRequest(request, "rest", input, "services.import", async (context) => {
    if (!context.settings.api.manualSyncEnabled) {
      throw new ResellerApiError("SYNC_DISABLED", "Manual service synchronization is disabled.", 403);
    }
    const filter: Record<string, unknown> = { active: true };
    if (parsed.data.serviceIds?.length) filter._id = { $in: parsed.data.serviceIds };
    if (parsed.data.category) filter.category = parsed.data.category;
    const offset = parsed.data.offset ?? 0;
    const limit = parsed.data.limit ?? 500;
    const total = await Service.countDocuments(filter);
    const services = await Service.find(filter)
      .populate({ path: "provider", match: { enabled: true }, select: "_id" })
      .sort({ category: 1, name: 1 })
      .skip(offset)
      .limit(limit)
      .lean();
    const available = services.filter((service) => service.provider);
    const results = [];
    for (const service of available) {
      const serviceId = String(service._id);
      const mapping = await ApiServiceMapping.findOneAndUpdate(
        { user: context.user._id, service: service._id },
        {
          $set: { status: "active", lastSyncedAt: new Date() },
          $setOnInsert: { externalId: serviceId, importedAt: new Date() },
        },
        { upsert: true, new: true },
      ).lean();
      results.push({
        externalId: mapping.externalId,
        ...publicService(service, getApiDiscount(context)),
      });
    }
    const nextOffset = offset + services.length < total ? offset + services.length : null;
    return {
      imported: results.length,
      totalMatching: total,
      nextOffset,
      services: results,
      syncedAt: new Date().toISOString(),
    };
  });
}
