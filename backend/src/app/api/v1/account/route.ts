import { NextRequest } from "next/server";
import { getApiDiscount, runResellerApiRequest } from "@/lib/reseller-api";

export async function GET(request: NextRequest) {
  return runResellerApiRequest(request, "rest", {}, "account.read", async ({ apiKey, user, settings }) => ({
    id: String(user._id),
    name: user.name,
    email: user.email,
    apiAccessEnabled: user.apiAccessEnabled !== false,
    balance: Number(user.walletBalance ?? 0),
    currency: "INR",
    discountPercent: getApiDiscount({ apiKey, user, settings }),
    key: { id: String(apiKey._id), prefix: apiKey.prefix, createdAt: apiKey.createdAt, lastUsedAt: apiKey.lastUsedAt ?? null },
  }));
}
