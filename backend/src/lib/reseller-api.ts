import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { calculateOrderPrice, roundMoney } from "@/lib/pricing";
import { dbConnect } from "@/lib/db";
import { getOrderQueueKey, processOrderQueue } from "@/lib/order-queue";
import { rateLimit } from "@/lib/rate-limit";
import { getProviderStatuses, normalizeProviderOrderStatus, providerStatusForOrder } from "@/lib/provider";
import {
  ApiIdempotency,
  ApiKey,
  ApiRequestLog,
  Order,
  Service,
  User,
  WalletTransaction,
  getSettings,
} from "@/models";

export class ResellerApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ResellerApiError";
  }
}

export type ResellerApiContext = {
  apiKey: InstanceType<typeof ApiKey>;
  user: InstanceType<typeof User>;
  settings: Awaited<ReturnType<typeof getSettings>>;
};

type ApiProtocol = "standard" | "rest";

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateResellerApiKey() {
  const secret = `smm_live_${randomBytes(32).toString("base64url")}`;
  return { secret, prefix: secret.slice(0, 16), secretHash: hashKey(secret) };
}

function responseError(code: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function standardError(code: string, message: string, status: number) {
  return NextResponse.json(
    { error: message, code },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export function responseSuccess(data: unknown, message = "Request completed successfully") {
  return NextResponse.json(
    { success: true, data, message },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function readApiInput(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") {
    return Object.fromEntries(new URL(request.url).searchParams.entries());
  }
  const body = await request.text();
  if (body.length > 32_000) throw new ResellerApiError("REQUEST_TOO_LARGE", "Request body is too large.", 413);
  if (!body) return {};
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = new URLSearchParams(body);
    return Object.fromEntries(form.entries());
  }
  if (!contentType.includes("application/json")) {
    throw new ResellerApiError("INVALID_CONTENT_TYPE", "Use application/json or application/x-www-form-urlencoded.", 415);
  }
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new ResellerApiError("INVALID_REQUEST", "Request body must contain valid JSON.", 400);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ResellerApiError("INVALID_REQUEST", "Request body must be a JSON object.", 400);
  }
  return value as Record<string, unknown>;
}

function requestIp(request: NextRequest) {
  const candidates = [
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const candidate of candidates) {
    const ip = candidate?.trim().toLowerCase().slice(0, 64) ?? "";
    if (isIP(ip)) return ip;
  }
  return "";
}

export async function runResellerApiRequest(
  request: NextRequest,
  protocol: ApiProtocol,
  input: Record<string, unknown>,
  action: string,
  handler: (context: ResellerApiContext) => Promise<unknown>,
) {
  const startedAt = Date.now();
  let context: ResellerApiContext | null = null;
  let statusCode = 200;
  let errorCode: string | undefined;
  let response: NextResponse<unknown> = responseError("INTERNAL_ERROR", "The request could not be completed.", 500);

  try {
    await dbConnect();
    const settings = await getSettings();
    if (!settings.api.enabled || (protocol === "standard" ? !settings.api.standardEnabled : !settings.api.restEnabled)) {
      throw new ResellerApiError("API_DISABLED", "Reseller API is currently unavailable.", 503);
    }
    if (settings.api.maintenanceMode) {
      throw new ResellerApiError("API_MAINTENANCE", settings.api.maintenanceMessage, 503);
    }
    if (protocol === "rest" && settings.api.requireVersionHeader && request.headers.get("x-api-version")?.trim() !== "1") {
      throw new ResellerApiError("API_VERSION_REQUIRED", "Send X-API-Version: 1 for the versioned REST API.", 400);
    }

    const authorization = request.headers.get("authorization") ?? "";
    const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    const suppliedKey = bearer || request.headers.get("x-api-key")?.trim() ||
      (protocol === "standard" && typeof input.key === "string" ? input.key.trim() : "");
    if (!suppliedKey || suppliedKey.length > 200) {
      throw new ResellerApiError("INVALID_API_KEY", "The API key is invalid or inactive.", 401);
    }

    const secretHash = hashKey(suppliedKey);
    const apiKey = await ApiKey.findOne({ secretHash, revokedAt: null });
    if (!apiKey || !timingSafeEqual(Buffer.from(apiKey.secretHash), Buffer.from(secretHash))) {
      throw new ResellerApiError("INVALID_API_KEY", "The API key is invalid or inactive.", 401);
    }

    const user = await User.findById(apiKey.user);
    if (!user || user.role !== "user" || user.isBanned || user.apiAccessEnabled === false) {
      throw new ResellerApiError("API_ACCESS_DISABLED", "API access is disabled for this account.", 403);
    }
    context = { apiKey, user, settings };
    if (settings.api.enforceIpAllowlist) {
      const ip = requestIp(request);
      if (!ip || !(user.apiAllowedIps ?? []).includes(ip)) {
        throw new ResellerApiError("IP_NOT_ALLOWED", "This IP address is not allowed for the API account.", 403);
      }
    }
    if (!await rateLimit(`reseller:${String(apiKey._id)}`, settings.api.requestsPerMinute, 60_000)) {
      throw new ResellerApiError("RATE_LIMIT_EXCEEDED", "Too many API requests. Try again shortly.", 429);
    }

    apiKey.lastUsedAt = new Date();
    apiKey.lastUsedIp = requestIp(request);
    await apiKey.save();
    const data = await handler(context);
    response = protocol === "standard"
      ? NextResponse.json(data, { headers: { "cache-control": "no-store" } })
      : responseSuccess(data);
  } catch (error) {
    if (error instanceof ResellerApiError) {
      statusCode = error.status;
      errorCode = error.code;
      response = protocol === "standard"
        ? standardError(error.code, error.message, error.status)
        : responseError(error.code, error.message, error.status);
    } else {
      statusCode = 500;
      errorCode = "INTERNAL_ERROR";
      console.error("Reseller API request failed", {
        endpoint: new URL(request.url).pathname,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      response = protocol === "standard"
        ? standardError("INTERNAL_ERROR", "The request could not be completed.", 500)
        : responseError("INTERNAL_ERROR", "The request could not be completed.", 500);
    }
  }

  try {
    await ApiRequestLog.create({
      user: context?.user._id,
      apiKey: context?.apiKey._id,
      endpoint: new URL(request.url).pathname,
      action: action.slice(0, 60),
      success: statusCode < 400,
      statusCode,
      errorCode,
      durationMs: Date.now() - startedAt,
      ip: requestIp(request),
    });
  } catch (error) {
    console.error("Reseller API request log could not be saved", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }

  return response;
}

export function getApiDiscount(context: ResellerApiContext) {
  if (!context.settings.api.discountEnabled) return 0;
  if (context.settings.api.allowUserDiscountOverrides && typeof context.user.apiDiscountPercent === "number") {
    return Math.max(0, Math.min(100, context.user.apiDiscountPercent));
  }
  return Math.max(0, Math.min(100, context.settings.api.discountPercent));
}

export function publicService(service: {
  _id: unknown;
  name: string;
  category: string;
  type?: string;
  sellingRate: number;
  min?: number;
  max?: number;
  refill?: boolean;
  cancel?: boolean;
}, discountPercent: number) {
  const rate = roundMoney(service.sellingRate * (1 - discountPercent / 100));
  return {
    service: String(service._id),
    name: service.name,
    category: service.category,
    type: service.type ?? "Default",
    rate,
    min: service.min ?? 1,
    max: service.max ?? 100000,
    refill: service.refill === true,
    cancel: service.cancel === true,
    available: true,
  };
}

export async function placeResellerOrder(
  context: ResellerApiContext,
  input: { serviceId: string; link: string; quantity: number; idempotencyKey: string },
) {
  if (!mongoose.isValidObjectId(input.serviceId)) {
    throw new ResellerApiError("SERVICE_UNAVAILABLE", "The selected service is unavailable.", 404);
  }
  if (context.user.walletFrozen) {
    throw new ResellerApiError("WALLET_FROZEN", "Wallet access is restricted for this account.", 403);
  }
  if (!/^[\w.-]{8,120}$/.test(input.idempotencyKey)) {
    throw new ResellerApiError("INVALID_IDEMPOTENCY_KEY", "Provide a valid Idempotency-Key header.", 400);
  }
  let targetUrl: URL;
  try {
    targetUrl = new URL(input.link);
  } catch {
    throw new ResellerApiError("INVALID_LINK", "Provide a valid public HTTP or HTTPS link.", 400);
  }
  if (!["http:", "https:"].includes(targetUrl.protocol) || !targetUrl.hostname.includes(".")) {
    throw new ResellerApiError("INVALID_LINK", "Provide a valid public HTTP or HTTPS link.", 400);
  }

  const service = await Service.findById(input.serviceId).populate("provider").lean();
  if (!service || !service.active) throw new ResellerApiError("SERVICE_UNAVAILABLE", "The selected service is unavailable.", 404);
  if (!service.provider || !service.provider.enabled) {
    throw new ResellerApiError("SERVICE_UNAVAILABLE", "The selected service is unavailable.", 503);
  }
  if (!Number.isInteger(input.quantity) || input.quantity < service.min || input.quantity > service.max) {
    throw new ResellerApiError("INVALID_QUANTITY", `Quantity must be between ${service.min} and ${service.max}.`, 400);
  }

  const discountPercent = getApiDiscount(context);
  const finalRate = roundMoney(service.sellingRate * (1 - discountPercent / 100));
  const charge = calculateOrderPrice(finalRate, input.quantity);
  const providerCost = calculateOrderPrice(service.providerRate, input.quantity);
  const requestHash = hashKey(JSON.stringify({
    serviceId: input.serviceId,
    link: targetUrl.toString(),
    quantity: input.quantity,
  }));
  let idempotency: InstanceType<typeof ApiIdempotency> | null = null;
  try {
    idempotency = await ApiIdempotency.create({
      user: context.user._id,
      key: input.idempotencyKey,
      requestHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
    const existing = await ApiIdempotency.findOne({
      user: context.user._id,
      key: input.idempotencyKey,
    });
    if (!existing || existing.requestHash !== requestHash) {
      throw new ResellerApiError("IDEMPOTENCY_CONFLICT", "This Idempotency-Key was already used for a different request.", 409);
    }
    if (existing.status === "completed" && existing.order) {
      const previousOrder = await Order.findOne({ _id: existing.order, user: context.user._id }).lean();
      if (previousOrder) return { order: String(previousOrder._id), status: previousOrder.status, charge: previousOrder.sellingPrice };
    }
    throw new ResellerApiError("DUPLICATE_REQUEST", "This request is already being processed or previously failed.", 409);
  }
  if (!idempotency) throw new ResellerApiError("INTERNAL_ERROR", "The request could not be completed.", 500);

  const session = await mongoose.startSession();
  let orderId = "";
  try {
    await session.withTransaction(async () => {
      const chargedUser = await User.findOneAndUpdate(
        {
          _id: context.user._id,
          isBanned: { $ne: true },
          apiAccessEnabled: { $ne: false },
          walletFrozen: { $ne: true },
          walletBalance: { $gte: charge },
        },
        { $inc: { walletBalance: -charge } },
        { new: true, session },
      );
      if (!chargedUser) {
        const currentUser = await User.findById(context.user._id).session(session).lean();
        if (!currentUser || currentUser.isBanned || currentUser.apiAccessEnabled === false) {
          throw new ResellerApiError("API_ACCESS_DISABLED", "API access is disabled for this account.", 403);
        }
        if (currentUser.walletFrozen) throw new ResellerApiError("WALLET_FROZEN", "Wallet access is restricted for this account.", 403);
        throw new ResellerApiError("INSUFFICIENT_BALANCE", "Wallet balance is insufficient for this order.", 402);
      }

      const balanceBefore = chargedUser.walletBalance + charge;
      const orderDocuments = await Order.create([{
        user: context.user._id,
        service: service._id,
        provider: service.provider._id,
        link: targetUrl.toString(),
        queueKey: getOrderQueueKey(String(context.user._id), targetUrl.toString()),
        quantity: input.quantity,
        status: "Scheduled",
        providerCost,
        providerCharge: providerCost,
        sellingPrice: charge,
        profit: charge - providerCost,
        warningAcceptedAt: new Date(),
        source: "api",
        apiKey: context.apiKey._id,
        apiPricingSnapshot: {
          baseRate: service.sellingRate,
          discountPercent,
          finalRate,
          quantity: input.quantity,
        },
      }], { session });
      const order = orderDocuments[0];
      orderId = String(order._id);

      await WalletTransaction.create([{
        user: context.user._id,
        type: "debit",
        amount: charge,
        balanceBefore,
        balanceAfter: chargedUser.walletBalance,
        source: "api_order",
        reference: orderId,
      }], { session });
      await ApiIdempotency.updateOne(
        { _id: idempotency?._id, status: "processing" },
        { $set: { status: "completed", order: order._id } },
        { session },
      );
    });
  } catch (error) {
    await ApiIdempotency.updateOne({ _id: idempotency._id }, { $set: { status: "failed" } });
    throw error;
  } finally {
    await session.endSession();
  }

  await processOrderQueue(String(context.user._id), targetUrl.toString());
  const order = await Order.findOne({ _id: orderId, user: context.user._id }).select("_id status sellingPrice").lean();
  if (!order) throw new ResellerApiError("ORDER_CREATION_FAILED", "The order could not be loaded after creation.", 500);
  return { order: String(order._id), status: order.status, charge: order.sellingPrice };
}

export async function getOwnedOrderStatus(userId: unknown, orderId: string) {
  if (!mongoose.isValidObjectId(orderId)) throw new ResellerApiError("ORDER_NOT_FOUND", "Order not found.", 404);
  const order = await Order.findOne({ _id: orderId, user: userId })
    .select("_id status sellingPrice startCount remains createdAt updatedAt lastStatusSyncAt")
    .lean();
  if (!order) throw new ResellerApiError("ORDER_NOT_FOUND", "Order not found.", 404);
  return {
    order: String(order._id),
    status: order.status,
    charge: order.sellingPrice,
    start_count: order.startCount ?? null,
    remains: order.remains ?? null,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    last_verified_at: order.lastStatusSyncAt ?? null,
  };
}

export async function refreshOwnedOrderStatus(userId: unknown, orderId: string, providerTimeoutMs?: number) {
  if (!mongoose.isValidObjectId(orderId)) throw new ResellerApiError("ORDER_NOT_FOUND", "Order not found.", 404);
  const order = await Order.findOne({ _id: orderId, user: userId })
    .populate<{
      provider: {
        _id: unknown;
        name: string;
        apiUrl: string;
        apiKey: string;
        priority: number;
        enabled: boolean;
      } | null;
    }>("provider")
    .exec();
  if (!order) throw new ResellerApiError("ORDER_NOT_FOUND", "Order not found.", 404);
  const lastStatusCheckAt = order.apiStatusAttemptAt ?? order.lastStatusSyncAt;
  const recentlyVerified = lastStatusCheckAt && Date.now() - lastStatusCheckAt.getTime() < 60_000;
  const terminal = ["Completed", "Partial", "Canceled", "Failed"].includes(order.status);
  if (!terminal && !recentlyVerified && order.providerOrderId && order.provider?.enabled) {
    order.apiStatusAttemptAt = new Date();
    await order.save();
    const result = await getProviderStatuses(order.provider, [String(order.providerOrderId)], providerTimeoutMs);
    const providerStatus = providerStatusForOrder(result, String(order.providerOrderId));
    order.lastStatusSyncAt = new Date();
    if (providerStatus) {
      const normalizedStatus = normalizeProviderOrderStatus(providerStatus.status);
      if (normalizedStatus) {
        const orderStatusRank = ["Scheduled", "Pending", "Processing", "In Progress"];
        const currentRank = orderStatusRank.indexOf(order.status);
        const nextRank = orderStatusRank.indexOf(normalizedStatus);
        if (!(normalizedStatus === "Pending" && currentRank > nextRank)) order.status = normalizedStatus;
      }
      const startValue = providerStatus.start_count ?? providerStatus.startCount ?? providerStatus.start;
      const remainsValue = providerStatus.remains ?? providerStatus.remains_count ?? providerStatus.remaining;
      const startCount = startValue == null ? NaN : Number(startValue);
      const remains = remainsValue == null ? NaN : Number(remainsValue);
      if (Number.isFinite(startCount)) order.startCount = startCount;
      if (Number.isFinite(remains)) order.remains = remains;
      order.providerResponse = {
        ...(order.providerResponse ?? {}),
        lastStatus: providerStatus,
      };
    }
    await order.save();
  }
  return getOwnedOrderStatus(userId, orderId);
}
