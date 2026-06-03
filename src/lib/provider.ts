import { Provider } from "@/models";

type ProviderRecord = {
  _id: unknown;
  name: string;
  apiUrl: string;
  apiKey: string;
  priority: number;
};

type ProviderPayload = Record<string, string | number | boolean | undefined>;

export async function providerRequest<T>(
  provider: ProviderRecord,
  payload: ProviderPayload,
) {
  const body = new URLSearchParams();
  body.set("key", provider.apiKey);
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) body.set(key, String(value));
  }

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
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${provider.name} returned invalid JSON`);
  }
}

export async function getEnabledProviders() {
  return Provider.find({ enabled: true }).sort({ priority: 1 }).lean();
}

export async function ensureDefaultProviderFromEnv() {
  const apiUrl = process.env.PROVIDER_API_URL;
  const apiKey = process.env.PROVIDER_API_KEY;
  if (!apiUrl || !apiKey) return null;

  const existing = await Provider.findOne({ apiUrl, apiKey });
  if (existing) return existing;

  const providerCount = await Provider.countDocuments();
  return Provider.create({
    name: "Default Provider",
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
    }
  }
  throw new Error(`All providers failed. ${errors.join("; ")}`);
}
