import { createHash } from "node:crypto";
import { addProviderOrder, logProviderEvent } from "@/lib/provider";
import { Order, OrderQueue, User, WalletTransaction } from "@/models";

const ACTIVE_STATUSES = ["Pending", "Processing", "In Progress"];
const TERMINAL_STATUSES = ["Completed", "Partial", "Canceled", "Failed"];
const QUEUE_LOCK_MS = 120_000;

export class OrderQueueBusyError extends Error {
  constructor() {
    super("This link's order queue is busy. Please try again.");
    this.name = "OrderQueueBusyError";
  }
}

function normalizedLink(link: string) {
  const url = new URL(link);
  url.hash = "";
  return url.toString();
}

export function getOrderQueueKey(userId: string, link: string) {
  return createHash("sha256").update(`${userId}\n${normalizedLink(link)}`).digest("hex");
}

async function acquireQueueLock(userId: string, link: string) {
  const queueKey = getOrderQueueKey(userId, link);
  try {
    await OrderQueue.updateOne(
      { queueKey },
      { $setOnInsert: { user: userId, lockedUntil: new Date(0) } },
      { upsert: true },
    );
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) {
      throw error;
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const now = new Date();
    const queue = await OrderQueue.findOneAndUpdate(
      { queueKey, lockedUntil: { $lte: now } },
      { $set: { lockedUntil: new Date(now.getTime() + QUEUE_LOCK_MS) } },
      { new: true },
    );
    if (queue) return queue;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new OrderQueueBusyError();
}

export async function withOrderQueueLock<T>(
  userId: string,
  link: string,
  action: (queue: Awaited<ReturnType<typeof acquireQueueLock>>) => Promise<T>,
) {
  const queue = await acquireQueueLock(userId, link);
  const lockExpiry = queue.lockedUntil;
  try {
    return await action(queue);
  } finally {
    await OrderQueue.updateOne(
      { _id: queue._id, lockedUntil: lockExpiry },
      { $set: { lockedUntil: new Date(0) } },
    );
  }
}

async function refundFailedOrder(order: {
  _id: unknown;
  user: unknown;
  sellingPrice: number;
}) {
  if (order.sellingPrice <= 0) return;
  const userId = String(order.user);
  const reference = String(order._id);
  const existingRefund = await WalletTransaction.exists({
    user: userId,
    type: "refund",
    source: "order_failure",
    reference,
  });
  if (existingRefund) return;

  const user = await User.findById(userId);
  if (!user) throw new Error(`Cannot refund failed order ${reference}: user not found.`);
  const balanceBefore = user.walletBalance;
  user.walletBalance += order.sellingPrice;
  await user.save();
  await WalletTransaction.create({
    user: user._id,
    type: "refund",
    amount: order.sellingPrice,
    balanceBefore,
    balanceAfter: user.walletBalance,
    source: "order_failure",
    reference,
    note: "Automatic refund because the provider could not start the order.",
  });
}

export async function drainOrderQueueLocked(queue: Awaited<ReturnType<typeof acquireQueueLock>>) {
  while (true) {
    if (queue.activeOrder) {
      const activeOrder = await Order.findById(queue.activeOrder);
      if (
        activeOrder &&
        ACTIVE_STATUSES.includes(activeOrder.status) &&
        activeOrder.providerOrderId
      ) {
        return activeOrder;
      }

      if (
        activeOrder &&
        (TERMINAL_STATUSES.includes(activeOrder.status) ||
          (["Scheduled", "Processing"].includes(activeOrder.status) && !activeOrder.providerOrderId))
      ) {
        if (
          activeOrder.status === "Failed" &&
          activeOrder.providerResponse &&
          typeof activeOrder.providerResponse === "object" &&
          "submissionError" in activeOrder.providerResponse
        ) {
          await refundFailedOrder(activeOrder);
        }
        if (!TERMINAL_STATUSES.includes(activeOrder.status)) {
          activeOrder.status = "Failed";
          activeOrder.providerResponse = {
            ...(activeOrder.providerResponse ?? {}),
            submissionError: "Order submission did not finish. The amount was refunded.",
          };
          await activeOrder.save();
          await refundFailedOrder(activeOrder);
          await logProviderEvent({
            level: "error",
            scope: "order_queue",
            action: "recover",
            message: "Order submission did not finish before its queue lock expired.",
            details: { orderId: String(activeOrder._id), queueKey: queue.queueKey },
          });
        }
        queue.activeOrder = null;
        await queue.save();
      } else if (activeOrder) {
        return activeOrder;
      } else {
        queue.activeOrder = null;
        await queue.save();
      }
    }

    const nextOrder = await Order.findOne({
      queueKey: queue.queueKey,
      status: "Scheduled",
    }).sort({ createdAt: 1 });
    if (!nextOrder) return null;

    const legacyActiveOrders = await Order.find({
      user: queue.user,
      status: { $in: ACTIVE_STATUSES },
      providerOrderId: { $exists: true, $ne: "" },
      _id: { $ne: nextOrder._id },
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .select("_id link");
    const matchingLegacyOrder = legacyActiveOrders.find((candidate) => {
      try {
        return normalizedLink(candidate.link) === normalizedLink(nextOrder.link);
      } catch {
        return candidate.link === nextOrder.link;
      }
    });
    if (matchingLegacyOrder) {
      queue.activeOrder = matchingLegacyOrder._id;
      await queue.save();
      return matchingLegacyOrder;
    }

    queue.activeOrder = nextOrder._id;
    await queue.save();
    nextOrder.status = "Processing";
    await nextOrder.save();

    try {
      await nextOrder.populate(["provider", "service"]);
      if (!nextOrder.provider || !nextOrder.service || !nextOrder.provider.enabled) {
        throw new Error("The order's provider or service is unavailable.");
      }

      const providerResult = await addProviderOrder([nextOrder.provider], {
        service: nextOrder.service.providerServiceId,
        link: nextOrder.link,
        quantity: nextOrder.quantity,
      });
      nextOrder.provider = providerResult.provider._id;
      nextOrder.providerOrderId = String(providerResult.result.order);
      nextOrder.status = "Pending";
      nextOrder.providerResponse = providerResult.result;
      nextOrder.lastStatusSyncAt = new Date();
      await nextOrder.save();
      return nextOrder;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit queued order.";
      nextOrder.status = "Failed";
      nextOrder.providerResponse = {
        ...(nextOrder.providerResponse ?? {}),
        submissionError: message,
      };
      await nextOrder.save();
      await refundFailedOrder(nextOrder);
      await logProviderEvent({
        level: "error",
        scope: "order_queue",
        action: "submit",
        message,
        details: { orderId: String(nextOrder._id), queueKey: queue.queueKey },
      });
      queue.activeOrder = null;
      await queue.save();
    }
  }
}

export async function processOrderQueue(userId: string, link: string) {
  try {
    return await withOrderQueueLock(userId, link, (queue) => drainOrderQueueLocked(queue));
  } catch (error) {
    if (error instanceof OrderQueueBusyError) return null;
    throw error;
  }
}

export async function advanceOrderQueueAfterTerminal(
  orderId: string,
  userId: string,
  link: string,
) {
  return withOrderQueueLock(userId, link, async (queue) => {
    if (String(queue.activeOrder ?? "") === orderId) {
      queue.activeOrder = null;
      await queue.save();
    }
    return drainOrderQueueLocked(queue);
  });
}

export async function processScheduledOrderQueues(limit = 100) {
  const recoveryCutoff = new Date(Date.now() - QUEUE_LOCK_MS);
  const scheduledOrders = await Order.find({
    queueKey: { $exists: true, $ne: "" },
    $or: [
      { status: "Scheduled" },
      {
        status: "Processing",
        providerOrderId: { $in: [null, ""] },
        createdAt: { $lte: recoveryCutoff },
      },
      {
        status: "Failed",
        "providerResponse.submissionError": { $exists: true },
        createdAt: { $lte: recoveryCutoff },
      },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .select("user link");
  const queues = new Map<string, { userId: string; link: string }>();
  for (const order of scheduledOrders) {
    const key = getOrderQueueKey(String(order.user), order.link);
    if (!queues.has(key)) queues.set(key, { userId: String(order.user), link: order.link });
  }

  for (const { userId, link } of queues.values()) {
    await processOrderQueue(userId, link);
  }
  return queues.size;
}
