import { NextRequest } from "next/server";
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

    if (query) {
      const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const services = await Service.find({
        active: true,
        $or: [
          { name: { $regex: safeQuery, $options: "i" } },
          { category: { $regex: safeQuery, $options: "i" } },
        ],
      })
        .sort({ createdAt: -1, name: 1 })
        .limit(50)
        .select("name category sellingRate type min max")
        .lean();
      return ok({ services: services.map(summarizeService) });
    }

    const projection = "name category sellingRate type min max";
    const [latest, latestInstagram, latestYouTube] = await Promise.all([
      Service.find({ active: true })
        .sort({ createdAt: -1, _id: -1 })
        .limit(100)
        .select(projection)
        .lean(),
      Service.findOne({ active: true, ...platformFilter("instagram") })
        .sort({ createdAt: -1, _id: -1 })
        .select(projection)
        .lean(),
      Service.findOne({ active: true, ...platformFilter("youtube") })
        .sort({ createdAt: -1, _id: -1 })
        .select(projection)
        .lean(),
    ]);
    const selected = new Map<string, (typeof latest)[number]>();

    if (latestInstagram) selected.set(String(latestInstagram._id), latestInstagram);
    if (latestYouTube) selected.set(String(latestYouTube._id), latestYouTube);

    for (const service of latest) {
      if (selected.size >= limit) break;
      selected.set(String(service._id), service);
    }

    return ok({
      services: [...selected.values()].slice(0, limit).map(summarizeService),
      requestedCount: limit,
      includedInstagram: [...selected.values()].some((service) => platformForService(service.name, service.category) === "Instagram"),
      includedYouTube: [...selected.values()].some((service) => platformForService(service.name, service.category) === "YouTube"),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load campaign services", 403);
  }
}
