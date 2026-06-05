import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireAdmin } from "@/lib/api";
import { notifyInApp } from "@/lib/notifications";
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
    const order = await Order.findById(input.id).populate("provider").populate("service");
    if (!order) return fail("Order not found", 404);
    if (!["Pending", "Processing", "In Progress"].includes(order.status)) {
      return fail("Only active orders can be canceled");
    }
    if (!order.service?.cancel) return fail("This service does not support cancellation");
    if (!order.providerOrderId) return fail("Provider order id is missing");

    const before = order.toObject();
    const result = await cancelProviderOrder(order.provider, order.providerOrderId);
    if (result.error) return fail(result.error);

    order.status = "Canceled";
    order.providerResponse = { ...(order.providerResponse ?? {}), cancel: result };
    order.lastStatusSyncAt = new Date();
    await order.save();

    const existingRefund = await WalletTransaction.exists({
      user: order.user,
      type: "refund",
      source: "admin_order_cancel",
      reference: String(order._id),
    });
    if (!existingRefund && order.sellingPrice > 0) {
      const user = await User.findById(order.user);
      if (user) {
        const balanceBefore = user.walletBalance;
        user.walletBalance += order.sellingPrice;
        await user.save();
        await WalletTransaction.create({
          user: user._id,
          type: "refund",
          amount: order.sellingPrice,
          balanceBefore,
          balanceAfter: user.walletBalance,
          source: "admin_order_cancel",
          reference: String(order._id),
          createdBy: auth.id,
        });
      }
    }

    await AuditLog.create({
      actor: auth.id,
      action: "order.cancel",
      entity: "Order",
      entityId: String(order._id),
      before,
      after: order,
    });
    await notifyInApp({
      user: order.user,
      title: "Order canceled by admin",
      body: `Order ${order._id} was canceled and refunded.`,
    });
    return ok({ order });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to cancel order");
  }
}
