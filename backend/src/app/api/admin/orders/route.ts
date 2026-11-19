import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireAdmin } from "@/lib/api";
import { cancelAdminOrder, OrderQueueBusyError } from "@/lib/admin-orders";
import { Order } from "@/models";

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["cancel"]),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const q = searchParams.get("q");
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ link: new RegExp(safe, "i") }, { providerOrderId: new RegExp(safe, "i") }];
    }
    const orders = await Order.find(filter)
      .populate("user", "name email")
      .populate("service", "name cancel")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return ok({ orders });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load admin orders", 403);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    const input = await parseBody(request, patchSchema);
    const order = await cancelAdminOrder(input.id, auth.id);
    return ok({ order });
  } catch (error) {
    if (error instanceof OrderQueueBusyError) return fail(error.message, 409);
    if (error instanceof Error && error.message === "Order not found") return fail(error.message, 404);
    return fail(error instanceof Error ? error.message : "Unable to cancel order");
  }
}
