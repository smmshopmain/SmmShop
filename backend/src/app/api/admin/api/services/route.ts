import { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { ApiServiceMapping, getSettings, Service, User } from "@/models";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();
    if (!(await getSettings()).api.enabled) return fail("Reseller API is currently disabled.", 404);

    const params = request.nextUrl.searchParams;
    const pageValue = Number(params.get("page") ?? 1);
    const limitValue = Number(params.get("limit") ?? 50);
    const page = Number.isInteger(pageValue) ? Math.min(Math.max(pageValue, 1), 10000) : 1;
    const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 100) : 50;
    const filter: Record<string, unknown> = {};
    const status = params.get("status");
    if (status === "active" || status === "unavailable") filter.status = status;
    const query = params.get("q")?.trim().slice(0, 100);
    if (query) {
      const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const [users, services] = await Promise.all([
        User.find({ $or: [{ name: new RegExp(safe, "i") }, { email: new RegExp(safe, "i") }] }).select("_id").limit(100).lean(),
        Service.find({ $or: [{ name: new RegExp(safe, "i") }, { category: new RegExp(safe, "i") }] }).select("_id").limit(100).lean(),
      ]);
      filter.$or = [
        { externalId: new RegExp(safe, "i") },
        { user: { $in: users.map((user) => user._id) } },
        { service: { $in: services.map((service) => service._id) } },
      ];
    }

    const [mappings, total, summary] = await Promise.all([
      ApiServiceMapping.find(filter)
        .populate("user", "name email")
        .populate({ path: "service", select: "name category active providerRate sellingRate", populate: { path: "provider", select: "name enabled" } })
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ApiServiceMapping.countDocuments(filter),
      ApiServiceMapping.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    return ok({
      services: mappings.map((mapping) => ({
        id: String(mapping._id),
        externalId: mapping.externalId,
        status: mapping.status,
        importedAt: mapping.importedAt,
        lastSyncedAt: mapping.lastSyncedAt ?? null,
        user: mapping.user,
        service: mapping.service,
        effectiveStatus: mapping.status === "active" && mapping.service?.active && mapping.service.provider?.enabled
          ? "active"
          : "unavailable",
      })),
      summary: {
        active: summary.find((item) => item._id === "active")?.count ?? 0,
        unavailable: summary.find((item) => item._id === "unavailable")?.count ?? 0,
      },
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load API service mappings", 403);
  }
}
