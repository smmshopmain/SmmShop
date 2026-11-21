import { NextRequest } from "next/server";
import { refreshOwnedOrderStatus, runResellerApiRequest } from "@/lib/reseller-api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runResellerApiRequest(request, "rest", {}, "orders.status", async ({ user, settings }) => ({
    order: await refreshOwnedOrderStatus(user._id, id, settings.api.providerTimeoutMs),
  }));
}
