import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { notifyInApp } from "@/lib/notifications";
import { calculateOrderPrice, roundMoney } from "@/lib/pricing";
import {
  advanceOrderQueueAfterTerminal,
  drainOrderQueueLocked,
  getOrderQueueKey,
  OrderQueueBusyError,
  processOrderQueue,
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
import { notifyTelegram } from "@/lib/telegram";
import { Order, PromoCode, Service, User, WalletTransaction } from "@/models";

const schema = z.object({
  serviceId: z.string().min(1),
  link: z.url(),
  quantity: z.number().int().positive(),
  warningAccepted: z.literal(true),
  promoCode: z.string().trim().min(2).optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["cancel"]),
});

type ProviderRecord = {
  _id: unknown;
  name: string;
  apiUrl: string;
  apiKey: string;
  username?: string;
  priority: number;
};

type SyncableOrder = {
  _id: unknown;
  user: unknown;
  link: string;
  queueKey?: string;
  provider: ProviderRecord;
  providerOrderId?: string;
  status: string;
  startCount?: number;
  remains?: number;
  providerCharge?: number;
  providerCost: number;
  sellingPrice: number;
  profit: number;
  lastStatusSyncAt?: Date;
  providerResponse?: Record<string, unknown>;
  save: () => Promise<unknown>;
};

function getCancellationStatus(providerResponse: unknown): "accepted" | "unconfirmed" | "not-submitted" | undefined {
  if (!providerResponse || typeof providerResponse !== "object" || !("cancellationAttempt" in providerResponse)) {
    return undefined;
  }
  const attempt = providerResponse.cancellationAttempt;
  if (!attempt || typeof attempt !== "object" || !("attempted" in attempt)) return undefined;
  if (attempt.attempted === false) return "not-submitted";
  if (attempt.attempted !== true) return undefined;
  return "accepted" in attempt && attempt.accepted === true ? "accepted" : "unconfirmed";
}

function toUserOrder(order: {
  _id: unknown;
  link: string;
  quantity: number;
  status: string;
  sellingPrice: number;
  startCount?: number;
  remains?: number;
  createdAt: Date;
  updatedAt: Date;
  lastStatusSyncAt?: Date;
  adminCompletedAt?: Date;
  providerResponse?: unknown;
  service?: {
    _id?: unknown;
    name?: string;
    refill?: boolean;
    cancel?: boolean;
  } | null;
}) {
  return {
    _id: order._id,
    link: order.link,
    quantity: order.quantity,
    status: order.status,
    sellingPrice: order.sellingPrice,
    startCount: order.startCount,
    remains: order.remains,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    lastStatusSyncAt: order.lastStatusSyncAt,
    adminCompletedAt: order.adminCompletedAt,
    cancellationStatus: getCancellationStatus(order.providerResponse),
    service: order.service,
  };
}

function isValidOrderLink(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname.includes("."));
  } catch {
    return false;
  }
}

function finiteNumber(value: unknown) {
  if (typeof value === "string" && !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function syncOrdersWithProvider(orders: SyncableOrder[]) {
  const syncable = orders.filter((order) => order.providerOrderId && order.provider);
  const ordersByProvider = new Map<string, SyncableOrder[]>();

  for (const order of syncable) {
    const providerId = String(order.provider._id);
    ordersByProvider.set(providerId, [...(ordersByProvider.get(providerId) ?? []), order]);
  }

  let synced = 0;
  for (const providerOrders of ordersByProvider.values()) {
    const provider = providerOrders[0].provider;
    try {
      const statuses = await getProviderStatuses(
        provider,
        providerOrders.map((order) => String(order.providerOrderId)),
      );

      for (const order of providerOrders) {
        const status = providerStatusForOrder(statuses, String(order.providerOrderId));
        if (!status) continue;

        const normalizedStatus = normalizeProviderOrderStatus(status.status);
        if (normalizedStatus) order.status = normalizedStatus;

        const startCountValue = status.start_count ?? status.startCount ?? status.start ?? status.start_count_number;
        const startCount = finiteNumber(startCountValue);
        if (startCount !== undefined) order.startCount = startCount;

        const remainsValue = status.remains ?? status.remains_count ?? status.remaining ?? status.remains_number;
        const remains = finiteNumber(remainsValue);
        if (remains !== undefined) order.remains = remains;

        const providerChargeValue = status.charge ?? status.providerCharge ?? status.provider_charge;
        const providerCharge = finiteNumber(providerChargeValue);
        if (providerCharge !== undefined) {
          order.providerCharge = providerCharge;
          order.providerCost = providerCharge;
          order.profit = order.sellingPrice - providerCharge;
        }

        order.lastStatusSyncAt = new Date();
        order.providerResponse = { ...(order.providerResponse ?? {}), lastStatus: status };
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
          continue;
        }
        if (order.queueKey && ["Completed", "Partial", "Canceled", "Failed"].includes(order.status)) {
          await advanceOrderQueueAfterTerminal(String(order._id), String(order.user), order.link);
        }
        synced += 1;
      }
    } catch (error) {
      await logProviderEvent({
        provider,
        level: "error",
        scope: "user_status_sync",
        action: "status",
        message: error instanceof Error ? error.message : "User order status sync failed",
        details: { orderCount: providerOrders.length },
      });
    }
  }

  return synced;
}

export async function GET(request: NextRequest) {
  try {
    const { auth } = await requireUser();
    const shouldSync = request.nextUrl.searchParams.get("sync") === "1";
    const filter = { user: auth.id };

    if (shouldSync) {
      const syncBefore = new Date(Date.now() - 60_000);
      const activeOrders = (await Order.find({
        ...filter,
        status: { $in: ["Pending", "Processing", "In Progress", "Partial"] },
        providerOrderId: { $exists: true, $nin: [null, ""] },
        adminCompletedAt: { $exists: false },
        $or: [
          { lastStatusSyncAt: { $lt: syncBefore } },
          { lastStatusSyncAt: { $exists: false } },
        ],
      })
        .populate("provider")
        .sort({ createdAt: -1 })
        .limit(100)) as unknown as SyncableOrder[];
      await syncOrdersWithProvider(activeOrders);
    }

    const orders = await Order.find({ user: auth.id })
      .populate("service", "name category refill cancel")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return ok({ orders: orders.map(toUserOrder), syncedAt: new Date().toISOString() });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load orders", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    const { auth, dbUser } = await requireUser();
    if (dbUser.walletFrozen) return fail("Wallet is frozen", 403);

    const service = await Service.findById(input.serviceId).populate("provider").lean();
    if (!service || !service.active) return fail("Service is unavailable", 404);
    if (!service.provider?.enabled) return fail("This service is temporarily unavailable.", 503);
    if (!isValidOrderLink(input.link)) return fail("Enter a valid public http/https link");
    if (input.quantity < service.min || input.quantity > service.max) {
      return fail(`Quantity must be between ${service.min} and ${service.max}`);
    }

    const providerCost = calculateOrderPrice(service.providerRate, input.quantity);
    const grossSellingPrice = calculateOrderPrice(service.sellingRate, input.quantity);
    let promoDiscount = 0;
    let promo = null;
    if (input.promoCode) {
      promo = await PromoCode.findOne({ code: input.promoCode.toUpperCase(), active: true });
      if (!promo) return fail("Invalid promo code", 404);
      if (promo.expiresAt && promo.expiresAt < new Date()) return fail("Promo code expired");
      if (promo.maxUses && promo.usedCount >= promo.maxUses) return fail("Promo code limit reached");
      if (grossSellingPrice < promo.minOrderAmount) return fail("Order does not meet minimum promo amount");
      promoDiscount =
        promo.discountType === "percent"
          ? roundMoney((grossSellingPrice * promo.discountValue) / 100)
          : Math.min(grossSellingPrice, promo.discountValue);
    }
    const sellingPrice = Math.max(0, roundMoney(grossSellingPrice - promoDiscount));
    const chargedUser = await User.findOneAndUpdate(
      {
        _id: auth.id,
        walletFrozen: { $ne: true },
        walletBalance: { $gte: sellingPrice },
      },
      { $inc: { walletBalance: -sellingPrice } },
      { new: true },
    );
    if (!chargedUser) {
      if (dbUser.walletFrozen) return fail("Wallet is frozen", 403);
      return fail("Insufficient wallet balance", 402);
    }
    const balanceBefore = chargedUser.walletBalance + sellingPrice;
    const balanceAfter = chargedUser.walletBalance;

    const order = await Order.create({
      user: auth.id,
      service: service._id,
      provider: service.provider._id,
      link: input.link,
      queueKey: getOrderQueueKey(auth.id, input.link),
      quantity: input.quantity,
      status: "Scheduled",
      providerCost,
      providerCharge: providerCost,
      sellingPrice,
      promoCode: promo?.code,
      promoDiscount,
      profit: sellingPrice - providerCost,
      warningAcceptedAt: new Date(),
    });

    await WalletTransaction.create({
      user: auth.id,
      type: "debit",
      amount: sellingPrice,
      balanceBefore,
      balanceAfter,
      source: "order",
      reference: String(order._id),
    });
    if (promo) {
      promo.usedCount += 1;
      await promo.save();
      await WalletTransaction.create({
        user: auth.id,
        type: "promo",
        amount: promoDiscount,
        balanceBefore: balanceAfter,
        balanceAfter,
        source: "promo_code",
        reference: promo.code,
      });
    }

    await processOrderQueue(auth.id, input.link);
    const currentOrder = await Order.findById(order._id).lean();
    if (currentOrder?.status === "Failed") {
      return fail("Order could not be submitted. The amount was refunded.", 502);
    }

    await notifyInApp({
      user: auth.id,
      title: currentOrder?.status === "Scheduled" ? "Order scheduled" : "Order placed",
      body: currentOrder?.status === "Scheduled"
        ? `Order ${order._id} is queued and will start after the previous order for this link finishes.`
        : `Order ${order._id} placed for Rs.${sellingPrice}.`,
    });

    await notifyTelegram("New Order", [
      `User: ${auth.email}`,
      `Order: ${order._id}`,
      `Amount: ${sellingPrice}`,
    ]);

    return ok({ order: currentOrder ? toUserOrder(currentOrder) : null });
  } catch (error) {
    await logProviderEvent({
      level: "error",
      scope: "api",
      action: "orders.post",
      message: error instanceof Error ? error.message : "Unable to place order",
    });
    return fail("Unable to place the order right now. Please try again.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const input = await parseBody(request, patchSchema);
    const { auth } = await requireUser();
    const existingOrder = await Order.findOne({ _id: input.id, user: auth.id }).select("link");
    if (!existingOrder) return fail("Order not found", 404);

    const canceledOrder = await withOrderQueueLock(auth.id, existingOrder.link, async (queue) => {
      const order = await Order.findOne({ _id: input.id, user: auth.id })
        .populate("provider");
      if (!order) throw new Error("Order not found");

      const wasScheduled = order.status === "Scheduled";
      if (wasScheduled) {
        order.status = "Canceled";
      } else {
        if (!["Pending", "Processing", "In Progress"].includes(order.status)) {
          throw new Error("Only active or scheduled orders can be canceled");
        }

        queue.activeOrder = order._id;
        await queue.save();
      }

      let cancellationAttempt: ProviderCancellationAttempt = {
        attempted: false,
        accepted: false,
        error: "Order was not submitted to the provider.",
      };
      if (!wasScheduled && order.providerOrderId && order.provider) {
        cancellationAttempt = await tryCancelProviderOrder(order.provider, order.providerOrderId);
      } else if (!wasScheduled && order.providerOrderId && !order.provider) {
        cancellationAttempt.error = "Provider record is unavailable.";
        await logProviderEvent({
          level: "warning",
          scope: "order_cancel",
          action: "cancel",
          message: "Provider record is unavailable; continuing with website cancellation.",
          details: { orderId: String(order._id), providerOrderId: order.providerOrderId },
        });
      }

      order.providerResponse = {
        ...(order.providerResponse ?? {}),
        ...(cancellationAttempt.response !== undefined ? { cancel: cancellationAttempt.response } : {}),
        cancellationAttempt: { ...cancellationAttempt, attemptedAt: new Date() },
      };
      order.lastStatusSyncAt = new Date();
      await order.save();
      await drainOrderQueueLocked(queue);
      return { order, cancellationAttempt };
    });

    const message = canceledOrder.cancellationAttempt.attempted
      ? canceledOrder.cancellationAttempt.accepted
        ? "Cancellation request accepted. The order was canceled on the website."
        : "The order was canceled on the website, but cancellation could not be confirmed. The service may continue."
      : "The order was canceled before processing started.";

    await notifyInApp({
      user: auth.id,
      title: "Order canceled",
      body: `Order ${canceledOrder.order._id} was canceled. ${message} No refund was issued.`,
    });

    return ok({
      order: {
        _id: canceledOrder.order._id,
        status: canceledOrder.order.status,
        cancellationStatus: canceledOrder.cancellationAttempt.attempted
          ? canceledOrder.cancellationAttempt.accepted ? "accepted" : "unconfirmed"
          : "not-submitted",
      },
      message: `${message} No refund was issued.`,
    });
  } catch (error) {
    if (error instanceof OrderQueueBusyError) return fail(error.message, 409);
    await logProviderEvent({
      level: "error",
      scope: "api",
      action: "orders.patch",
      message: error instanceof Error ? error.message : "Unable to cancel order",
    });
    const message = error instanceof Error ? error.message : "";
    return fail(
      ["Order not found", "Only active or scheduled orders can be canceled"].includes(message)
        ? message
        : "Unable to cancel order right now. Please try again.",
    );
  }
}
