import { ORDER_STATUSES, REFILL_STATUSES } from "@/lib/constants";
import { Provider, ProviderLog } from "@/models";

type ProviderRecord = {
  _id: unknown;
  name: string;
  apiUrl: string;
  apiKey: string;
  priority: number;
};

type ProviderPayload = Record<string, string | number | boolean | undefined>;

type ProviderErrorResult = { error?: string };

export async function logProviderEvent({
  provider,
  level = "info",
  scope,
  action,
  message,
  details,
}: {
  provider?: { _id?: unknown } | null;
  level?: "info" | "warning" | "error";
  scope: string;
  action: string;
  message: string;
  details?: unknown;
}) {
  try {
    await ProviderLog.create({
      provider: provider?._id,
      level,
      scope,
      action,
      message,
      details,
    });
  } catch (error) {
    console.error("Provider log failed", error);
  }
}

export async function providerRequest<T>(
  provider: ProviderRecord,
  payload: ProviderPayload,
) {
  const body = new URLSearchParams();
  body.set("key", provider.apiKey);
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) body.set(key, String(value));
  }

  try {
    const response = await fetch(provider.apiUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`${provider.name} responded with ${response.status}`);
    }

    const text = await response.text();
    let parsed: T & ProviderErrorResult;
    try {
      parsed = JSON.parse(text) as T & ProviderErrorResult;
    } catch {
      throw new Error(`${provider.name} returned invalid JSON`);
    }
    if (parsed && typeof parsed === "object" && "error" in parsed && parsed.error) {
      throw new Error(String(parsed.error));
    }
    return parsed as T;
  } catch (error) {
    await logProviderEvent({
      provider,
      level: "error",
      scope: "provider_api",
      action: String(payload.action ?? "request"),
      message: error instanceof Error ? error.message : "Provider request failed",
      details: { apiUrl: provider.apiUrl, payload: { ...payload, key: undefined } },
    });
    throw error;
  }
}

export async function getEnabledProviders() {
  return Provider.find({ enabled: true }).sort({ priority: 1 }).lean();
}

export async function ensureDefaultProviderFromEnv() {
  const apiUrl = process.env.PROVIDER_API_URL || "https://cheapestsmmpanels.com/api/v2";
  const apiKey = process.env.PROVIDER_API_KEY;
  if (!apiKey) return null;

  const existing = await Provider.findOne({ apiUrl, apiKey });
  if (existing) return existing;

  const providerCount = await Provider.countDocuments();
  return Provider.create({
    name: "Cheapest SMM Panels",
    apiUrl,
    apiKey,
    enabled: true,
    priority: providerCount + 1,
  });
}

export async function addProviderOrder(
  providers: ProviderRecord[],
  payload: { service: string; link: string; quantity: number },
) {
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const result = await providerRequest<{ order?: string | number; error?: string }>(provider, {
        action: "add",
        ...payload,
      });
      if (result.error) throw new Error(result.error);
      if (!result.order) throw new Error("Provider did not return an order id");
      return { provider, result };
    } catch (error) {
      errors.push(`${provider.name}: ${error instanceof Error ? error.message : "unknown error"}`);
      await Provider.findByIdAndUpdate(provider._id, { lastError: errors.at(-1) });
      await logProviderEvent({
        provider,
        level: "error",
        scope: "order",
        action: "add",
        message: errors.at(-1) ?? "Provider order failed",
        details: payload,
      });
    }
  }
  throw new Error(`All providers failed. ${errors.join("; ")}`);
}

export type ProviderStatus = {
  status?: string;
  start_count?: string | number;
  remains?: string | number;
  charge?: string | number;
};

export async function getProviderStatuses(
  provider: ProviderRecord,
  orderIds: string[],
) {
  if (orderIds.length === 0) return {};
  if (orderIds.length === 1) {
    const status = await providerRequest<ProviderStatus>(provider, {
      action: "status",
      order: orderIds[0],
    });
    return { [orderIds[0]]: status };
  }

  const result = await providerRequest<Record<string, ProviderStatus | { error?: string }>>(provider, {
    action: "status",
    orders: orderIds.join(","),
  });

  return result;
}

export async function cancelProviderOrder(provider: ProviderRecord, orderId: string) {
  return providerRequest<{ cancel?: string | number; error?: string }>(provider, {
    action: "cancel",
    order: orderId,
  });
}

export async function requestProviderRefill(provider: ProviderRecord, orderId: string) {
  return providerRequest<{ refill?: string | number; error?: string }>(provider, {
    action: "refill",
    order: orderId,
  });
}

export async function getProviderRefillStatus(provider: ProviderRecord, refillId: string) {
  return providerRequest<{ status?: string; error?: string }>(provider, {
    action: "refill_status",
    refill: refillId,
  });
}

export async function getProviderBalance(provider: ProviderRecord) {
  return providerRequest<{ balance?: string | number; currency?: string; error?: string }>(provider, {
    action: "balance",
  });
}

export function parseProviderBoolean(value: unknown) {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    return ["1", "true", "yes", "y", "on"].includes(value.trim().toLowerCase());
  }
  return false;
}

export function normalizeProviderOrderStatus(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (normalized === "cancelled") return "Canceled";
  const match = ORDER_STATUSES.find((status) => status.toLowerCase() === normalized);
  return match;
}

export function normalizeProviderRefillStatus(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
  const match = REFILL_STATUSES.find((status) => status.toLowerCase() === normalized);
  return match;
}
