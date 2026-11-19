import { notifyInApp } from "@/lib/notifications";
import { drainOrderQueueLocked, OrderQueueBusyError, withOrderQueueLock } from "@/lib/order-queue";
import { cancelProviderOrder } from "@/lib/provider";
import { AuditLog, Order, User, WalletTransaction } from "@/models";

export async function cancelAdminOrder(orderId: string, actorId: string) {
  const existingOrder = await Order.findById(orderId).select("user link");
  if (!existingOrder) throw new Error("Order not found");

  const result = await withOrderQueueLock(String(existingOrder.user), existingOrder.link, async (queue) => {
    const currentOrder = await Order.findById(orderId).populate("provider").populate("service");
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
      const providerResult = await cancelProviderOrder(currentOrder.provider, currentOrder.providerOrderId);
      if (providerResult.error) throw new Error(providerResult.error);
      currentOrder.providerResponse = { ...(currentOrder.providerResponse ?? {}), cancel: providerResult };
    }
    currentOrder.status = "Canceled";
    currentOrder.lastStatusSyncAt = new Date();
    await currentOrder.save();
    await drainOrderQueueLocked(queue);
    return { order: currentOrder, before };
  });

  const existingRefund = await WalletTransaction.exists({
    user: result.order.user,
    type: "refund",
    source: "admin_order_cancel",
    reference: String(result.order._id),
  });
  if (!existingRefund && result.order.sellingPrice > 0) {
    const user = await User.findById(result.order.user);
    if (user) {
      const balanceBefore = user.walletBalance;
      user.walletBalance += result.order.sellingPrice;
      await user.save();
      await WalletTransaction.create({
        user: user._id,
        type: "refund",
        amount: result.order.sellingPrice,
        balanceBefore,
        balanceAfter: user.walletBalance,
        source: "admin_order_cancel",
        reference: String(result.order._id),
        createdBy: actorId,
      });
    }
  }

  await AuditLog.create({
    actor: actorId,
    action: "order.cancel",
    entity: "Order",
    entityId: String(result.order._id),
    before: result.before,
    after: result.order,
  });
  await notifyInApp({
    user: result.order.user,
    title: "Order canceled by admin",
    body: `Order ${result.order._id} was canceled and refunded.`,
  });
  return result.order;
}

export { OrderQueueBusyError };
