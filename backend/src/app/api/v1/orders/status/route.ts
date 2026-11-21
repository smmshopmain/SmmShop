import { NextRequest } from "next/server";
import { z } from "zod";
import { readApiInput, ResellerApiError, runResellerApiRequest } from "@/lib/reseller-api";
import { Order } from "@/models";

export async function POST(request: NextRequest) {
  let input: Record<string, unknown>;
  try {
    input = await readApiInput(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid API request.";
    return Response.json({ success: false, error: { code: "INVALID_REQUEST", message } }, { status: 400 });
  }
  const parsed = z.object({ orderIds: z.array(z.string().min(1)).min(1).max(100) }).safeParse(input);
  if (!parsed.success) {
    return Response.json({
      success: false,
      error: { code: "INVALID_REQUEST", message: "Provide between 1 and 100 order IDs." },
    }, { status: 400 });
  }

  return runResellerApiRequest(request, "rest", input, "orders.status.bulk", async ({ user }) => {
    const orders = await Order.find({ user: user._id, _id: { $in: parsed.data.orderIds } })
      .select("_id status sellingPrice startCount remains createdAt updatedAt lastStatusSyncAt")
      .lean();
    return {
      orders: orders.map((order) => ({
        id: String(order._id),
        status: order.status,
        charge: order.sellingPrice,
        startCount: order.startCount ?? null,
        remains: order.remains ?? null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        lastVerifiedAt: order.lastStatusSyncAt ?? null,
      })),
    };
  });
}
