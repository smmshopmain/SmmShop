import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { getServicePlatform, SERVICE_PLATFORMS, type ServicePlatform } from "@/lib/service-platforms";
import { Category, Service } from "@/models";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPlatformConditions(platform: ServicePlatform) {
  const expressions = platform.keywords.map((keyword) => new RegExp(escapeRegex(keyword), "i"));
  return [
    ...expressions.map((expression) => ({ category: expression })),
    ...expressions.map((expression) => ({ name: expression })),
  ];
}

function buildPlatformFilter(platform: ServicePlatform) {
  return { $or: buildPlatformConditions(platform) };
}

function buildOtherPlatformFilter() {
  return { $nor: SERVICE_PLATFORMS.flatMap((item) => buildPlatformConditions(item)) };
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const category = searchParams.get("category");
    const platformParam = searchParams.get("platform");
    const serviceId = searchParams.get("id");
    if (serviceId && !/^[a-f\d]{24}$/i.test(serviceId)) return fail("Invalid service id.");
    const platform = getServicePlatform(platformParam);
    const platformFilter = platform
      ? buildPlatformFilter(platform)
      : platformParam === "other"
        ? buildOtherPlatformFilter()
        : null;
    const filter: Record<string, unknown> = { active: true };
    if (serviceId) filter._id = serviceId;
    if (category) filter.category = category;
    if (query) {
      const terms = query.split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        filter.$and = terms.map((term) => {
          const expression = new RegExp(escapeRegex(term), "i");
          return { $or: [{ name: expression }, { category: expression }] };
        });
      }
    }
    if (platformFilter) Object.assign(filter, platformFilter);

    const [services, categories] = await Promise.all([
      Service.find(filter).sort({ sellingRate: 1, category: 1, name: 1 }).limit(250).lean(),
      platformFilter
        ? Service.distinct("category", {
            active: true,
            ...platformFilter,
          })
        : Category.find({ active: true }).sort({ name: 1 }).select("name").lean(),
    ]);
    const categoryNames = Array.isArray(categories)
      ? [...new Set(categories.map((item) => (typeof item === "string" ? item : item.name)))]
      : [];
    const fallbackCategories =
      categoryNames.length > 0 || platformFilter ? categoryNames : await Service.distinct("category", { active: true });
    fallbackCategories.sort((first, second) => first.localeCompare(second));
    return ok({ services, categories: fallbackCategories });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load services");
  }
}
