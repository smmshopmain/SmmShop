import { NextRequest } from "next/server";
import { isIP } from "node:net";
import mongoose from "mongoose";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { ApiKey, ApiRequestLog, AuditLog, Order, User, getSettings } from "@/models";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("access"), userId: z.string().min(1), enabled: z.boolean() }),
  z.object({ action: z.literal("revoke"), keyId: z.string().min(1) }),
  z.object({ action: z.literal("discount"), userId: z.string().min(1), discountPercent: z.number().min(0).max(100).nullable() }),
  z.object({
    action: z.literal("ip-allowlist"),
    userId: z.string().min(1),
    allowedIps: z.array(z.string().trim().min(1).max(64)).max(50)
      .transform((ips) => [...new Set(ips.map((ip) => ip.toLowerCase()))])
      .superRefine((ips, context) => {
        ips.forEach((ip, index) => {
          if (!isIP(ip)) context.addIssue({ code: "custom", path: [index], message: "Enter an IPv4 or IPv6 address without a port or CIDR suffix." });
        });
      }),
  }),
]);

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();
    const settings = await getSettings();
    if (!settings.api.enabled) return fail("Reseller API is currently disabled.", 404);
    const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100);
    const fromParam = request.nextUrl.searchParams.get("from");
    const toParam = request.nextUrl.searchParams.get("to");
    const logPage = Math.min(Math.max(Number(request.nextUrl.searchParams.get("page") ?? 1) || 1, 1), 10000);
    const userPage = Math.min(Math.max(Number(request.nextUrl.searchParams.get("userPage") ?? 1) || 1, 1), 10000);
    const logFilter: Record<string, unknown> = {};
    if (fromParam || toParam) {
      const createdAt: Record<string, Date> = {};
      if (fromParam) {
        const from = new Date(fromParam);
        if (Number.isNaN(from.getTime())) return fail("Invalid log start date.", 400);
        createdAt.$gte = from;
      }
      if (toParam) {
        const to = new Date(toParam);
        if (Number.isNaN(to.getTime())) return fail("Invalid log end date.", 400);
        if (/^\d{4}-\d{2}-\d{2}$/.test(toParam)) to.setHours(23, 59, 59, 999);
        createdAt.$lte = to;
      }
      logFilter.createdAt = createdAt;
    }
    const logUserId = request.nextUrl.searchParams.get("userId");
    if (logUserId) logFilter.user = logUserId;
    const successParam = request.nextUrl.searchParams.get("success");
    if (successParam === "true") logFilter.success = true;
    if (successParam === "false") logFilter.success = false;
    const endpointParam = request.nextUrl.searchParams.get("endpoint")?.trim().slice(0, 100);
    if (endpointParam) {
      const escapedEndpoint = endpointParam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      logFilter.endpoint = new RegExp(escapedEndpoint, "i");
    }
    const userIds = await ApiKey.distinct("user");
    const userFilter: Record<string, unknown> = { _id: { $in: userIds } };
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      userFilter.$or = [
        { name: new RegExp(escaped, "i") },
        { email: new RegExp(escaped, "i") },
      ];
    }

    const [users, activeUsers, disabledUsers, totalOrders, todayOrders, requestCount, todayRequests, failedRequests, averageDuration, logs, matchingLogCount, activeKeys, totalKeys, orderTotals] = await Promise.all([
      User.find(userFilter).select("name email apiAccessEnabled apiDiscountPercent apiAllowedIps isBanned createdAt").sort({ createdAt: -1 }).skip((userPage - 1) * 100).limit(100).lean(),
      User.countDocuments({ _id: { $in: userIds }, apiAccessEnabled: { $ne: false }, isBanned: { $ne: true } }),
      User.countDocuments({ _id: { $in: userIds }, $or: [{ apiAccessEnabled: false }, { isBanned: true }] }),
      Order.countDocuments({ source: "api" }),
      Order.countDocuments({ source: "api", createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      ApiRequestLog.countDocuments(),
      ApiRequestLog.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      ApiRequestLog.countDocuments({ success: false }),
      ApiRequestLog.aggregate([
        { $group: { _id: null, averageMs: { $avg: "$durationMs" } } },
      ]),
      ApiRequestLog.find(logFilter)
        .populate("user", "name email")
        .populate("apiKey", "name prefix")
        .sort({ createdAt: -1 })
        .skip((logPage - 1) * 100)
        .limit(100)
        .lean(),
      ApiRequestLog.countDocuments(logFilter),
      ApiKey.countDocuments({ revokedAt: null }),
      ApiKey.countDocuments(),
      Order.aggregate([
        { $match: { source: "api" } },
        { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$sellingPrice" } } },
      ]),
    ]);
    const matchingUserCount = await User.countDocuments(userFilter);

    const ids = users.map((user) => user._id);
    const [keyStats, allKeys, orderStats, activity] = await Promise.all([
      ApiKey.aggregate([
        { $match: { user: { $in: ids } } },
        { $group: { _id: "$user", total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ["$revokedAt", null] }, 1, 0] } } } },
      ]),
      ApiKey.find({ user: { $in: ids } }).select("user name prefix revokedAt lastUsedAt createdAt").sort({ createdAt: -1 }).lean(),
      Order.aggregate([
        { $match: { user: { $in: ids }, source: "api" } },
        { $group: { _id: "$user", count: { $sum: 1 }, spending: { $sum: "$sellingPrice" } } },
      ]),
      ApiRequestLog.aggregate([
        { $match: { user: { $in: ids } } },
        { $group: { _id: "$user", lastActivity: { $max: "$createdAt" } } },
      ]),
    ]);
    const keyByUser = new Map(keyStats.map((item) => [String(item._id), item]));
    const orderByUser = new Map(orderStats.map((item) => [String(item._id), item]));
    const activityByUser = new Map(activity.map((item) => [String(item._id), item.lastActivity]));
    return ok({
      enabled: true,
      stats: {
        users: userIds.length,
        activeUsers,
        disabledUsers,
        totalOrders,
        todayOrders,
        totalRequests: requestCount,
        todayRequests,
        failedRequests,
        averageResponseTimeMs: Math.round(averageDuration[0]?.averageMs ?? 0),
        errorRatePercent: requestCount ? Math.round((failedRequests / requestCount) * 10000) / 100 : 0,
        activeKeys,
        totalKeys,
        revenue: orderTotals
          .filter((item) => !["Failed", "Refunded"].includes(String(item._id)))
          .reduce((sum, item) => sum + item.revenue, 0),
        completedOrders: orderTotals.filter((item) => item._id === "Completed").reduce((sum, item) => sum + item.count, 0),
        pendingOrders: orderTotals.filter((item) => ["Scheduled", "Pending", "Processing", "In Progress"].includes(item._id)).reduce((sum, item) => sum + item.count, 0),
        failedOrders: orderTotals.filter((item) => item._id === "Failed").reduce((sum, item) => sum + item.count, 0),
      },
      users: users.map((user) => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        accessEnabled: user.apiAccessEnabled !== false && user.isBanned !== true,
        discountPercent: user.apiDiscountPercent ?? null,
        allowedIps: user.apiAllowedIps ?? [],
        registrationDate: user.createdAt,
        keyCount: keyByUser.get(String(user._id))?.total ?? 0,
        activeKeyCount: keyByUser.get(String(user._id))?.active ?? 0,
        keys: allKeys.filter((key) => String(key.user) === String(user._id)).map((key) => ({
          id: String(key._id),
          name: key.name,
          prefix: key.prefix,
          revokedAt: key.revokedAt,
          lastUsedAt: key.lastUsedAt ?? null,
          createdAt: key.createdAt,
        })),
        orderCount: orderByUser.get(String(user._id))?.count ?? 0,
        spending: orderByUser.get(String(user._id))?.spending ?? 0,
        lastActivity: activityByUser.get(String(user._id)) ?? null,
      })),
      logs,
      logsPage: logPage,
      logsTotal: matchingLogCount,
      usersPage: userPage,
      usersTotal: matchingUserCount,
      usersPages: Math.ceil(matchingUserCount / 100),
      logsPages: Math.ceil(matchingLogCount / 100),
      settings: settings.api,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load API management", 403);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const settings = await getSettings();
    if (!settings.api.enabled) return fail("Reseller API is currently disabled.", 404);
    const input = patchSchema.parse(await request.json());
    const targetId = input.action === "revoke" ? input.keyId : input.userId;
    if (!mongoose.isValidObjectId(targetId)) return fail("Invalid API management identifier.", 400);

    if (input.action === "access") {
      const user = await User.findByIdAndUpdate(input.userId, { $set: { apiAccessEnabled: input.enabled } }, { new: true })
        .select("name email apiAccessEnabled");
      if (!user) return fail("User not found.", 404);
      await AuditLog.create({
        actor: auth.id,
        action: input.enabled ? "api.user.enable" : "api.user.disable",
        entity: "User",
        entityId: input.userId,
        after: { apiAccessEnabled: input.enabled },
      });
      return ok({ user });
    }

    if (input.action === "ip-allowlist") {
      const user = await User.findOneAndUpdate(
        { _id: input.userId, role: "user" },
        { $set: { apiAllowedIps: input.allowedIps } },
        { new: true },
      ).select("name email apiAllowedIps");
      if (!user) return fail("API user not found.", 404);
      await AuditLog.create({
        actor: auth.id,
        action: "api.user.ip_allowlist",
        entity: "User",
        entityId: input.userId,
        after: { apiAllowedIps: user.apiAllowedIps },
      });
      return ok({ user });
    }

    if (input.action === "revoke") {
      const key = await ApiKey.findOneAndUpdate(
        { _id: input.keyId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
        { new: true },
      ).select("user name prefix revokedAt");
      if (!key) return fail("Active API key not found.", 404);
      await AuditLog.create({
        actor: auth.id,
        action: "api.key.revoke",
        entity: "ApiKey",
        entityId: input.keyId,
        after: { revokedAt: key.revokedAt },
      });
      return ok({ revoked: true });
    }

    if (!settings.api.allowUserDiscountOverrides) return fail("Individual discount overrides are disabled.", 403);
    const user = await User.findByIdAndUpdate(
      input.userId,
      { $set: { apiDiscountPercent: input.discountPercent } },
      { new: true },
    ).select("name email apiDiscountPercent");
    if (!user) return fail("User not found.", 404);
    await AuditLog.create({
      actor: auth.id,
      action: "api.user.discount",
      entity: "User",
      entityId: input.userId,
      after: { apiDiscountPercent: input.discountPercent },
    });
    return ok({ user });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update API access");
  }
}
