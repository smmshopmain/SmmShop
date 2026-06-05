import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { logProviderEvent, requestProviderRefill } from "@/lib/provider";
import { notifyTelegram } from "@/lib/telegram";
import { Order, Refill } from "@/models";

const schema = z.object({ orderId: z.string().min(1) });

export async function GET() {
  try {
    const { auth } = await requireUser();
    const refills = await Refill.find({ user: auth.id })
      .populate("order", "providerOrderId link status")
      .sort({ createdAt: -1 })
      .lean();
    return ok({ refills });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load refills", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    const { auth } = await requireUser();
    const order = await Order.findOne({ _id: input.orderId, user: auth.id })
      .populate("provider")
      .populate("service");
    if (!order) return fail("Order not found", 404);
    if (!order.service.refill) return fail("This service does not support refill");
    if (!order.providerOrderId) return fail("Provider order id is missing");

    const result = await requestProviderRefill(order.provider, order.providerOrderId);

    const refill = await Refill.create({
      user: auth.id,
      order: order._id,
      provider: order.provider._id,
      providerRefillId: result.refill ? String(result.refill) : undefined,
      providerResponse: result,
    });
    await notifyTelegram("Refill Request", [`User: ${auth.email}`, `Order: ${order._id}`]);
    return ok({ refill });
  } catch (error) {
    await logProviderEvent({
      level: "error",
      scope: "api",
      action: "refills.post",
      message: error instanceof Error ? error.message : "Unable to request refill",
    });
    return fail(error instanceof Error ? error.message : "Unable to request refill");
  }
}
