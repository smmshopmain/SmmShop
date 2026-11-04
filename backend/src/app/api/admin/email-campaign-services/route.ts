import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { fail, ok, requireAdmin } from "@/lib/api";
import { getServicePlatform, SERVICE_PLATFORMS } from "@/lib/service-platforms";
import { dbConnect } from "@/lib/db";
import { Service } from "@/models";

function platformForService(name: string, category: string) {
  const text = `${name} ${category}`.toLowerCase();
  return SERVICE_PLATFORMS.find((platform) =>
    platform.keywords.some((keyword) => text.includes(keyword)),
  )?.label ?? "Other";
}

function platformFilter(platformId: "instagram" | "youtube") {
  const platform = getServicePlatform(platformId);
  if (!platform) return {};
  const expressions = platform.keywords.map((keyword) =>
    new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  );
  return {
    $or: [
      ...expressions.map((expression) => ({ name: expression })),
      ...expressions.map((expression) => ({ category: expression })),
    ],
  };
}

function summarizeService(service: {
  _id: unknown;
  name: string;
  category: string;
  sellingRate: number;
  type?: string;
  min?: number;
  max?: number;
}) {
  return {
    serviceId: String(service._id),
    name: service.name,
    category: service.category,
    platform: platformForService(service.name, service.category),
    sellingRate: service.sellingRate,
    type: service.type ?? "",
    min: service.min ?? 1,
    max: service.max ?? 100000,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim().slice(0, 100);
    const limit = searchParams.get("limit") === "5" ? 5 : 10;
    const excludedIds = (searchParams.get("exclude") ?? "")
      .split(",")
      .filter((id) => /^[a-f\d]{24}$/i.test(id))
      .slice(0, 10)
      .map((id) => new mongoose.Types.ObjectId(id));

    if (query) {
      const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const services = await Service.find({
        active: true,
        ...(excludedIds.length ? { _id: { $nin: excludedIds } } : {}),
        $or: [
          { name: { $regex: safeQuery, $options: "i" } },
          { category: { $regex: safeQuery, $options: "i" } },
        ],
      })
        .sort({ name: 1 })
        .limit(50)
        .select("name category sellingRate type min max")
        .lean();
      return ok({ services: services.map(summarizeService) });
    }

    const excluded = [...excludedIds];
    const sample = async (filter: Record<string, unknown>, count: number) => {
      if (count < 1) return [];
      return Service.aggregate([
        { $match: { active: true, ...filter, ...(excluded.length ? { _id: { $nin: excluded } } : {}) } },
        { $sample: { size: count } },
        { $project: { name: 1, category: 1, sellingRate: 1, type: 1, min: 1, max: 1 } },
      ]);
    };
    const [instagram, youtube] = await Promise.all([
      sample(platformFilter("instagram"), 1),
      sample(platformFilter("youtube"), 1),
    ]);
    const selected = new Map<string, (typeof instagram)[number]>();
    for (const service of [...instagram, ...youtube]) selected.set(String(service._id), service);

    excluded.push(...[...selected.keys()].map((id) => new mongoose.Types.ObjectId(id)));
    const remaining = await Service.aggregate([
      { $match: { active: true, ...(excluded.length ? { _id: { $nin: excluded } } : {}) } },
      { $sample: { size: Math.max(0, limit - selected.size) } },
      { $project: { name: 1, category: 1, sellingRate: 1, type: 1, min: 1, max: 1 } },
    ]);
    for (const service of remaining) selected.set(String(service._id), service);
    return ok({
      services: [...selected.values()].map(summarizeService),
      requestedCount: limit,
      includedInstagram: [...selected.values()].some((service) => platformForService(service.name, service.category) === "Instagram"),
      includedYouTube: [...selected.values()].some((service) => platformForService(service.name, service.category) === "YouTube"),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load campaign services", 403);
  }
}
