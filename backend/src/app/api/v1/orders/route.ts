import { NextRequest } from "next/server";
import { z } from "zod";
import { placeResellerOrder, readApiInput, runResellerApiRequest } from "@/lib/reseller-api";
import { Order } from "@/models";

const orderSchema = z.object({
  serviceId: z.string().min(1).max(80),
  link: z.string().url().max(2048),
  quantity: z.number().int().positive(),
});

export async function GET(request: NextRequest) {
  const parsedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;
  const parsedOffset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  const offset = Number.isInteger(parsedOffset) ? Math.max(parsedOffset, 0) : 0;
  return runResellerApiRequest(request, "rest", {}, "orders.list", async ({ user }) => {
    const filter = { user: user._id, source: "api" };
    const [orders, total] = await Promise.all([
      Order.find(filter)
      .select("_id service status quantity sellingPrice startCount remains createdAt updatedAt lastStatusSyncAt")
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
      Order.countDocuments(filter),
    ]);
    return {
      orders: orders.map((order) => ({
        id: String(order._id),
        serviceId: String(order.service),
        status: order.status,
        quantity: order.quantity,
        charge: order.sellingPrice,
        startCount: order.startCount ?? null,
        remains: order.remains ?? null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        lastVerifiedAt: order.lastStatusSyncAt ?? null,
      })),
      total,
      limit,
      offset,
      nextOffset: offset + orders.length < total ? offset + orders.length : null,
    };
  });
}

export async function POST(request: NextRequest) {
  let input: Record<string, unknown>;
  try {
    input = await readApiInput(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid API request.";
    return Response.json({ success: false, error: { code: "INVALID_REQUEST", message } }, { status: 400 });
  }
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({
      success: false,
      error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid order details." },
    }, { status: 400 });
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!idempotencyKey) {
    return Response.json({
      success: false,
      error: { code: "IDEMPOTENCY_KEY_REQUIRED", message: "Provide an Idempotency-Key header." },
    }, { status: 400 });
  }

  return runResellerApiRequest(request, "rest", input, "orders.create", async (context) => {
    return placeResellerOrder(context, { ...parsed.data, idempotencyKey });
  });
}
