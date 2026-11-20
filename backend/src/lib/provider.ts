import { ORDER_STATUSES, REFILL_STATUSES } from "@/lib/constants";
import { Provider, ProviderLog } from "@/models";

type ProviderRecord = {
  _id: unknown;
  name: string;
  apiUrl: string;
  apiKey: string;
  username?: string;
  priority: number;
};

type ProviderPayload = Record<string, string | number | boolean | undefined>;

type ProviderErrorResult = { error?: string };

async function updateProviderHealth(provider: ProviderRecord, errorMessage?: string) {
  if (!provider._id) return;

  try {
    await Provider.updateOne(
      { _id: provider._id },
      errorMessage ? { $set: { lastError: errorMessage } } : { $unset: { lastError: 1 } },
    );
  } catch (error) {
    console.error("Provider health status update failed", error);
  }
}

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function providerRequest<T>(
  provider: ProviderRecord,
  payload: ProviderPayload,
) {
  const body = new URLSearchParams();
  body.set("key", provider.apiKey);
  if (provider.username) {
    body.set("username", provider.username);
  }
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) body.set(key, String(value));
  }

  const maxAttempts = 3;
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    // add a timeout to avoid hanging requests
    const controller = new AbortController();
    const timeoutMs = Number(process.env.PROVIDER_REQUEST_TIMEOUT_MS ?? 15000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await logProviderEvent({
        provider,
        scope: "provider_api",
        action: String(payload.action ?? "request"),
        message: `Requesting ${String(payload.action ?? "request")} (attempt ${attempt})`,
        details: { apiUrl: provider.apiUrl, payload: { ...payload, key: undefined }, attempt },
      });

      const response = await fetch(provider.apiUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timer);
        const message = `${provider.name} responded with ${response.status}`;
        if (attempt >= maxAttempts || response.status < 500) {
          throw new Error(message);
        }
        lastError = new Error(message);
        await sleep(400 * attempt);
        continue;
      }

      const text = await response.text();
      clearTimeout(timer);

      await logProviderEvent({
        provider,
        scope: "provider_api",
        action: String(payload.action ?? "request"),
        message: `Provider response (length=${String(text.length)})`,
        details: { snippet: text.slice(0, 200) },
      });

      let parsed: T & ProviderErrorResult;
      try {
        parsed = JSON.parse(text) as T & ProviderErrorResult;
      } catch {
        throw new Error(`${provider.name} returned invalid JSON`);
      }
      if (parsed && typeof parsed === "object" && "error" in parsed && parsed.error) {
        throw new Error(String(parsed.error));
      }
      await updateProviderHealth(provider);
      return parsed as T;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      const retryable = error instanceof Error && attempt < maxAttempts && (error.name !== "AbortError");
      if (retryable) {
        await logProviderEvent({
          provider,
          level: "warning",
          scope: "provider_api",
          action: String(payload.action ?? "request"),
          message: `Retry ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`,
          details: { apiUrl: provider.apiUrl, payload: { ...payload, key: undefined }, attempt },
        });
        await sleep(500 * attempt);
        continue;
      }
      const message = error instanceof Error ? error.message : "Provider request failed";
      await updateProviderHealth(provider, message);
      await logProviderEvent({
        provider,
        level: "error",
        scope: "provider_api",
        action: String(payload.action ?? "request"),
        message,
        details: { apiUrl: provider.apiUrl, payload: { ...payload, key: undefined } },
      });
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Provider request failed");
}

export async function getEnabledProviders() {
  return Provider.find({ enabled: true }).sort({ priority: 1 }).lean();
}

export async function ensureDefaultProviderFromEnv() {
  const apiUrl = process.env.PROVIDER_API_URL;
  const apiKey = process.env.PROVIDER_API_KEY;
  const username = process.env.PROVIDER_USERNAME;
  if (!apiUrl || !apiKey) return null;

  const existing = await Provider.findOne({ apiUrl, apiKey });
  if (existing) {
    if (username && !existing.username) {
      existing.username = username;
      await existing.save();
    }
    return existing;
  }

  const providerCount = await Provider.countDocuments();
  return Provider.create({
    name: "Default provider",
    apiUrl,
    apiKey,
    username: username || undefined,
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
  startCount?: string | number;
  start?: string | number;
  start_count_number?: string | number;
  remains?: string | number;
  remains_count?: string | number;
  remaining?: string | number;
  remains_number?: string | number;
  charge?: string | number;
  providerCharge?: string | number;
  provider_charge?: string | number;
};

export type ProviderCancellationAttempt = {
  attempted: boolean;
  accepted: boolean;
  response?: unknown;
  error?: string;
};

function isProviderStatus(value: unknown): value is ProviderStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return [
    "status",
    "start_count",
    "startCount",
    "start",
    "start_count_number",
    "remains",
    "remains_count",
    "remaining",
    "remains_number",
    "charge",
    "providerCharge",
    "provider_charge",
  ].some((key) => key in value);
}

export function providerStatusForOrder(value: unknown, orderId: string): ProviderStatus | null {
  if (Array.isArray(value)) {
    const matchingOrder = value.find((item) => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      return String(record.order ?? record.order_id ?? record.id ?? "") === orderId;
    });
    if (matchingOrder) return providerStatusForOrder(matchingOrder, orderId);
    return value.length === 1 ? providerStatusForOrder(value[0], orderId) : null;
  }
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const direct = record[orderId];
  if (direct !== undefined) {
    const directStatus = providerStatusForOrder(direct, orderId);
    if (directStatus) return directStatus;
  }

  for (const key of ["data", "result", "response", "orders", "statuses"] as const) {
    const nestedStatus = providerStatusForOrder(record[key], orderId);
    if (nestedStatus) return nestedStatus;
  }

  return isProviderStatus(record) ? record : null;
}

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

function providerCancellationAccepted(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(providerCancellationAccepted);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("cancel" in record) return providerCancellationAccepted(record.cancel);
    if ("status" in record && ["success", "accepted"].includes(String(record.status).trim().toLowerCase())) {
      return true;
    }
    return ["data", "result", "response"].some((key) => providerCancellationAccepted(record[key]));
  }
  if (typeof value === "string" && ["success", "accepted", "cancelled", "canceled"].includes(value.trim().toLowerCase())) {
    return true;
  }
  return parseProviderBoolean(value);
}

export async function tryCancelProviderOrder(
  provider: ProviderRecord,
  orderId: string,
): Promise<ProviderCancellationAttempt> {
  try {
    const response = await cancelProviderOrder(provider, orderId);
    const accepted = providerCancellationAccepted(response);
    if (accepted) return { attempted: true, accepted: true, response };

    const error = response.error ?? "Provider did not confirm the cancellation.";
    await logProviderEvent({
      provider,
      level: "warning",
      scope: "order_cancel",
      action: "cancel",
      message: `${error} The website will still cancel the order.`,
      details: { providerOrderId: orderId, response },
    });
    return { attempted: true, accepted: false, response, error };
  } catch (requestError) {
    const error = requestError instanceof Error ? requestError.message : "Provider cancellation request failed.";
    await logProviderEvent({
      provider,
      level: "warning",
      scope: "order_cancel",
      action: "cancel",
      message: `${error} The website will still cancel the order.`,
      details: { providerOrderId: orderId },
    });
    return { attempted: true, accepted: false, error };
  }
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

function normalizeStatusValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeToken(value: string) {
  return value.replace(/\s+/g, "");
}

export function normalizeProviderOrderStatus(value: unknown) {
  const normalized = normalizeStatusValue(value);
  const compact = normalizeToken(normalized);
  if (normalized === "cancelled" || compact === "cancelled") return "Canceled";
  if (compact === "complete" || compact === "completed") return "Completed";
  if (["failed", "error", "rejected"].includes(compact)) return "Failed";

  for (const status of ORDER_STATUSES) {
    const candidate = status.toLowerCase();
    const candidateCompact = normalizeToken(candidate);
    if (normalized === candidate || compact === candidateCompact) return status;
  }

  return undefined;
}

export function normalizeProviderRefillStatus(value: unknown) {
  const normalized = normalizeStatusValue(value);
  const compact = normalizeToken(normalized);
  for (const status of REFILL_STATUSES) {
    const candidate = status.toLowerCase();
    const candidateCompact = normalizeToken(candidate);
    if (normalized === candidate || compact === candidateCompact) return status;
  }
  return undefined;
}
