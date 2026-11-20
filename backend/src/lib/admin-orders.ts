import { notifyInApp } from "@/lib/notifications";
import {
  drainOrderQueueLocked,
  OrderQueueBusyError,
  withOrderQueueLock,
} from "@/lib/order-queue";
import {
  getProviderStatuses,
  logProviderEvent,
  normalizeProviderOrderStatus,
  providerStatusForOrder,
  tryCancelProviderOrder,
  type ProviderCancellationAttempt,
} from "@/lib/provider";
import { AuditLog, Order, User, WalletTransaction } from "@/models";

function providerNumber(value: unknown) {
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function findOrderRefund(order: { user: unknown; _id: unknown }) {
  return WalletTransaction.exists({
    user: order.user,
    type: "refund",
    reference: String(order._id),
  });
}

export async function cancelAdminOrder(orderId: string, actorId: string) {
  const existingOrder = await Order.findById(orderId).select("user link");
  if (!existingOrder) throw new Error("Order not found");

  const result = await withOrderQueueLock(String(existingOrder.user), existingOrder.link, async (queue) => {
    const currentOrder = await Order.findById(orderId).populate("provider");
    if (!currentOrder) throw new Error("Order not found");
    const before = currentOrder.toObject();
    const wasScheduled = currentOrder.status === "Scheduled";
    if (wasScheduled) {
      currentOrder.status = "Canceled";
    } else {
      if (!["Pending", "Processing", "In Progress"].includes(currentOrder.status)) {
        throw new Error("Only active or scheduled orders can be canceled");
      }
      queue.activeOrder = currentOrder._id;
      await queue.save();
    }
    let cancellationAttempt: ProviderCancellationAttempt = {
      attempted: false,
      accepted: false,
      error: "Order was not submitted to the provider.",
    };
    if (!wasScheduled && currentOrder.providerOrderId && currentOrder.provider) {
      cancellationAttempt = await tryCancelProviderOrder(currentOrder.provider, currentOrder.providerOrderId);
    }
    if (
      !wasScheduled &&
      currentOrder.providerOrderId &&
      !currentOrder.provider
    ) {
      cancellationAttempt.error = "Provider record is unavailable.";
      await logProviderEvent({
        level: "warning",
        scope: "order_cancel",
        action: "cancel",
        message: "Provider record is unavailable; continuing with website cancellation.",
        details: { orderId: String(currentOrder._id), providerOrderId: currentOrder.providerOrderId },
      });
    }
    currentOrder.providerResponse = {
      ...(currentOrder.providerResponse ?? {}),
      ...(cancellationAttempt.response !== undefined ? { cancel: cancellationAttempt.response } : {}),
      cancellationAttempt: { ...cancellationAttempt, attemptedAt: new Date() },
    };
    currentOrder.status = "Canceled";
    currentOrder.lastStatusSyncAt = new Date();
    await currentOrder.save();
    const existingRefund = await WalletTransaction.exists({
      user: currentOrder.user,
      type: "refund",
      source: "admin_order_cancel",
      reference: String(currentOrder._id),
    });
    if (!existingRefund && currentOrder.sellingPrice > 0) {
      const user = await User.findById(currentOrder.user);
      if (user) {
        const balanceBefore = user.walletBalance;
        user.walletBalance += currentOrder.sellingPrice;
        await user.save();
        await WalletTransaction.create({
          user: user._id,
          type: "refund",
          amount: currentOrder.sellingPrice,
          balanceBefore,
          balanceAfter: user.walletBalance,
          source: "admin_order_cancel",
          reference: String(currentOrder._id),
          createdBy: actorId,
        });
      }
    }
    await drainOrderQueueLocked(queue);
    return { order: currentOrder, before, cancellationAttempt };
  });

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
    body: `${result.cancellationAttempt.attempted
      ? result.cancellationAttempt.accepted
        ? "The provider accepted the cancellation."
        : "The provider did not confirm cancellation; provider work may continue."
      : "The order had not been sent to the provider."} Order ${result.order._id} was canceled and refunded.`,
  });
  return {
    order: result.order,
    message: result.cancellationAttempt.attempted
      ? result.cancellationAttempt.accepted
        ? "Provider accepted cancellation. The order was canceled and refunded."
        : "The website canceled and refunded the order, but the provider did not confirm cancellation and may continue work."
      : "The order was canceled and refunded before provider submission.",
  };
}

export async function completeAdminOrder(orderId: string, actorId: string) {
  const existingOrder = await Order.findById(orderId).select("user link");
  if (!existingOrder) throw new Error("Order not found");

  const result = await withOrderQueueLock(String(existingOrder.user), existingOrder.link, async (queue) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");
    if (await findOrderRefund(order)) {
      throw new Error("This order has already been refunded and cannot be marked completed.");
    }
    if (order.status === "Completed") throw new Error("This order is already completed.");

    const before = order.toObject();
    order.status = "Completed";
    order.remains = 0;
    order.adminCompletedAt = new Date();
    await order.save();
    await drainOrderQueueLocked(queue);
    return { order, before };
  });

  await AuditLog.create({
    actor: actorId,
    action: "order.complete",
    entity: "Order",
    entityId: String(result.order._id),
    before: result.before,
    after: result.order,
  });
  await notifyInApp({
    user: result.order.user,
    title: "Order marked completed",
    body: `Order ${result.order._id} was manually marked completed by an admin.`,
  });
  return result.order;
}

export async function reverifyAdminOrder(orderId: string, actorId: string) {
  const existingOrder = await Order.findById(orderId).populate("provider");
  if (!existingOrder) throw new Error("Order not found");
  if (!existingOrder.provider) throw new Error("This order's provider is unavailable.");
  if (!existingOrder.providerOrderId) throw new Error("This order has no provider order ID to reverify.");
  if (existingOrder.adminReverifiedAt) throw new Error("This order has already been reverified by an admin.");

  const providerOrderId = String(existingOrder.providerOrderId);
  const statuses = await getProviderStatuses(existingOrder.provider, [providerOrderId]);
  const providerStatus = providerStatusForOrder(statuses, providerOrderId);
  if (!providerStatus) throw new Error("Provider did not return this order's status.");

  const result = await withOrderQueueLock(String(existingOrder.user), existingOrder.link, async (queue) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.adminReverifiedAt) throw new Error("This order has already been reverified by an admin.");

    const before = order.toObject();
    const hasRefund = await findOrderRefund(order);
    const normalizedStatus = normalizeProviderOrderStatus(providerStatus.status);
    const terminalStatuses = ["Completed", "Partial", "Canceled", "Failed"];
    const wasTerminal = terminalStatuses.includes(order.status);

    if (normalizedStatus && !hasRefund && !order.adminCompletedAt) {
      if (!wasTerminal || terminalStatuses.includes(normalizedStatus)) {
        order.status = normalizedStatus;
      }
    }

    const startCount = providerNumber(
      providerStatus.start_count ?? providerStatus.startCount ?? providerStatus.start ?? providerStatus.start_count_number,
    );
    if (startCount !== null) order.startCount = startCount;

    const remains = providerNumber(
      providerStatus.remains ?? providerStatus.remains_count ?? providerStatus.remaining ?? providerStatus.remains_number,
    );
    if (remains !== null) order.remains = remains;
    else if (normalizedStatus === "Completed") order.remains = 0;

    const charge = providerNumber(providerStatus.charge ?? providerStatus.providerCharge ?? providerStatus.provider_charge);
    if (charge !== null) {
      order.providerCharge = charge;
      order.providerCost = charge;
      order.profit = order.sellingPrice - charge;
    }

    order.providerResponse = { ...(order.providerResponse ?? {}), lastStatus: providerStatus };
    order.lastStatusSyncAt = new Date();
    order.adminReverifiedAt = new Date();
    await order.save();

    const manuallyCompleted = await Order.exists({
      _id: order._id,
      adminCompletedAt: { $exists: true },
    });
    if (manuallyCompleted) {
      await Order.updateOne(
        { _id: order._id, adminCompletedAt: { $exists: true } },
        { $set: { status: "Completed", remains: 0 } },
      );
      order.status = "Completed";
      order.remains = 0;
    }

    if (order.queueKey && terminalStatuses.includes(order.status)) {
      await drainOrderQueueLocked(queue);
    }
    return { order, before, hasRefund };
  });

  await AuditLog.create({
    actor: actorId,
    action: "order.reverify",
    entity: "Order",
    entityId: String(result.order._id),
    before: result.before,
    after: result.order,
  });
  return {
    order: result.order,
    message: result.hasRefund
      ? "Provider status was reverified. The order status was not changed because it has been refunded."
      : "Provider status reverified.",
  };
}

export { OrderQueueBusyError };
