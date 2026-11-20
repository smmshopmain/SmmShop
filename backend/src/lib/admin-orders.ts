import { notifyInApp } from "@/lib/notifications";
import {
  drainOrderQueueLocked,
  OrderQueueBusyError,
  withOrderQueueLock,
} from "@/lib/order-queue";
import {
  cancelProviderOrder,
  getProviderStatuses,
  normalizeProviderOrderStatus,
} from "@/lib/provider";
import { AuditLog, Order, User, WalletTransaction } from "@/models";

type ReverifiedProviderStatus = {
  status?: string;
  start_count?: string | number;
  startCount?: string | number;
  start?: string | number;
  start_count_number?: string | number;
  remains?: string | number;
  remains_count?: string | number;
  remaining?: string | number;
  remains_number?: string | number;
  charge?: string | number;
  providerCharge?: string | number;
  provider_charge?: string | number;
};

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
    return { order: currentOrder, before };
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
    body: `Order ${result.order._id} was canceled and refunded.`,
  });
  return result.order;
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
  const providerStatus = statuses[providerOrderId] as ReverifiedProviderStatus | undefined;
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
