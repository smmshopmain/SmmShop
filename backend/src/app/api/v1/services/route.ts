import { NextRequest } from "next/server";
import { getApiDiscount, publicService, runResellerApiRequest } from "@/lib/reseller-api";
import { Service } from "@/models";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category")?.trim();
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 100);
  const requestedOffset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100;
  const offset = Number.isInteger(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
  return runResellerApiRequest(request, "rest", {}, "services.list", async (context) => {
    const filter: Record<string, unknown> = { active: true };
    if (category) filter.category = category.slice(0, 120);
    const [services, total] = await Promise.all([
      Service.find(filter)
        .populate({ path: "provider", match: { enabled: true }, select: "_id" })
        .sort({ category: 1, name: 1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      Service.countDocuments(filter),
    ]);
    return {
      services: services.filter((service) => service.provider).map((service) => publicService(service, getApiDiscount(context))),
      totalMatching: total,
      limit,
      offset,
      nextOffset: offset + services.length < total ? offset + services.length : null,
      syncedAt: new Date().toISOString(),
    };
  });
}
