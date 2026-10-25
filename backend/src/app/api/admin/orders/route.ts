import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireAdmin } from "@/lib/api";
import { notifyInApp } from "@/lib/notifications";
import { drainOrderQueueLocked, OrderQueueBusyError, withOrderQueueLock } from "@/lib/order-queue";
import { cancelProviderOrder } from "@/lib/provider";
import { AuditLog, Order, User, WalletTransaction } from "@/models";

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
    const existingOrder = await Order.findById(input.id).select("user link");
    if (!existingOrder) return fail("Order not found", 404);
    const order = await withOrderQueueLock(String(existingOrder.user), existingOrder.link, async (queue) => {
      const currentOrder = await Order.findById(input.id).populate("provider").populate("service");
      if (!currentOrder) throw new Error("Order not found");
      const before = currentOrder.toObject();
      if (currentOrder.status === "Scheduled") {
        currentOrder.status = "Canceled";
      } else {
        if (!["Pending", "Processing", "In Progress"].includes(currentOrder.status)) {
          throw new Error("Only active or scheduled orders can be canceled");
        }
        if (!currentOrder.service?.cancel) throw new Error("This service does not support cancellation");
        if (!currentOrder.providerOrderId) throw new Error("Provider order id is missing");

        queue.activeOrder = currentOrder._id;
        await queue.save();
        const result = await cancelProviderOrder(currentOrder.provider, currentOrder.providerOrderId);
        if (result.error) throw new Error(result.error);
        currentOrder.providerResponse = { ...(currentOrder.providerResponse ?? {}), cancel: result };
      }
      currentOrder.status = "Canceled";
      currentOrder.lastStatusSyncAt = new Date();
      await currentOrder.save();
      await drainOrderQueueLocked(queue);
      return { order: currentOrder, before };
    });
    const { before } = order;

    const existingRefund = await WalletTransaction.exists({
      user: order.order.user,
      type: "refund",
      source: "admin_order_cancel",
      reference: String(order.order._id),
    });
    if (!existingRefund && order.order.sellingPrice > 0) {
      const user = await User.findById(order.order.user);
      if (user) {
        const balanceBefore = user.walletBalance;
        user.walletBalance += order.order.sellingPrice;
        await user.save();
        await WalletTransaction.create({
          user: user._id,
          type: "refund",
          amount: order.order.sellingPrice,
          balanceBefore,
          balanceAfter: user.walletBalance,
          source: "admin_order_cancel",
          reference: String(order.order._id),
          createdBy: auth.id,
        });
      }
    }

    await AuditLog.create({
      actor: auth.id,
      action: "order.cancel",
      entity: "Order",
      entityId: String(order.order._id),
      before,
      after: order.order,
    });
    await notifyInApp({
      user: order.order.user,
      title: "Order canceled by admin",
      body: `Order ${order.order._id} was canceled and refunded.`,
    });
    return ok({ order: order.order });
  } catch (error) {
    if (error instanceof OrderQueueBusyError) return fail(error.message, 409);
    return fail(error instanceof Error ? error.message : "Unable to cancel order");
  }
}
