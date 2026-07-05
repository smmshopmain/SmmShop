import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { notifyInApp } from "@/lib/notifications";
import { calculateOrderPrice, roundMoney } from "@/lib/pricing";
import {
  addProviderOrder,
  cancelProviderOrder,
  getProviderStatuses,
  logProviderEvent,
  normalizeProviderOrderStatus,
} from "@/lib/provider";
import { notifyTelegram } from "@/lib/telegram";
import { Order, PromoCode, Service, WalletTransaction } from "@/models";

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

type StatusResponse = {
  status?: string;
  start_count?: string | number;
  remains?: string | number;
  charge?: string | number;
};

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

function isValidOrderLink(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname.includes("."));
  } catch {
    return false;
  }
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
        const status = statuses[String(order.providerOrderId)] as StatusResponse | undefined;
        if (!status) continue;

        const normalizedStatus = normalizeProviderOrderStatus(status.status);
        if (normalizedStatus) order.status = normalizedStatus;

        if (status.start_count !== undefined) {
          const startCount = Number(status.start_count);
          if (Number.isFinite(startCount)) order.startCount = startCount;
        }

        if (status.remains !== undefined) {
          const remains = Number(status.remains);
          if (Number.isFinite(remains)) order.remains = remains;
        }

        if (status.charge !== undefined) {
          const providerCharge = Number(status.charge);
          if (Number.isFinite(providerCharge)) {
            order.providerCharge = providerCharge;
            order.providerCost = providerCharge;
            order.profit = order.sellingPrice - providerCharge;
          }
        }

        order.lastStatusSyncAt = new Date();
        order.providerResponse = { ...(order.providerResponse ?? {}), lastStatus: status };
        await order.save();
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
      const activeOrders = (await Order.find({
        ...filter,
        status: { $in: ["Pending", "Processing", "In Progress", "Partial"] },
        providerOrderId: { $exists: true },
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
    return ok({ orders, syncedAt: new Date().toISOString() });
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
    if (!service.provider?.enabled) return fail("Provider is disabled for this service", 503);
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
    if (dbUser.walletBalance < sellingPrice) return fail("Insufficient wallet balance", 402);

    const balanceBefore = dbUser.walletBalance;
    dbUser.walletBalance -= sellingPrice;
    await dbUser.save();

    let providerResult;
    try {
      providerResult = await addProviderOrder([service.provider], {
        service: service.providerServiceId,
        link: input.link,
        quantity: input.quantity,
      });
    } catch (error) {
      dbUser.walletBalance = balanceBefore;
      await dbUser.save();
      await logProviderEvent({
        provider: service.provider,
        level: "error",
        scope: "order",
        action: "add",
        message: error instanceof Error ? error.message : "Unable to place provider order",
        details: { service: service.providerServiceId, quantity: input.quantity },
      });
      throw error;
    }

    const order = await Order.create({
      user: auth.id,
      service: service._id,
      provider: providerResult.provider._id,
      providerOrderId: String(providerResult.result.order),
      link: input.link,
      quantity: input.quantity,
      status: "Pending",
      providerCost,
      providerCharge: providerCost,
      sellingPrice,
      promoCode: promo?.code,
      promoDiscount,
      profit: sellingPrice - providerCost,
      warningAcceptedAt: new Date(),
      providerResponse: providerResult.result,
    });

    await WalletTransaction.create({
      user: auth.id,
      type: "debit",
      amount: sellingPrice,
      balanceBefore,
      balanceAfter: dbUser.walletBalance,
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
        balanceBefore: dbUser.walletBalance,
        balanceAfter: dbUser.walletBalance,
        source: "promo_code",
        reference: promo.code,
      });
    }

    await notifyInApp({
      user: auth.id,
      title: "Order placed",
      body: `Order ${order._id} placed for Rs.${sellingPrice}.`,
    });

    await notifyTelegram("New Order", [
      `User: ${auth.email}`,
      `Order: ${order._id}`,
      `Amount: ${sellingPrice}`,
    ]);

    return ok({ order });
  } catch (error) {
    await logProviderEvent({
      level: "error",
      scope: "api",
      action: "orders.post",
      message: error instanceof Error ? error.message : "Unable to place order",
    });
    return fail(error instanceof Error ? error.message : "Unable to place order");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const input = await parseBody(request, patchSchema);
    const { auth, dbUser } = await requireUser();
    const order = await Order.findOne({ _id: input.id, user: auth.id })
      .populate("provider")
      .populate("service");
    if (!order) return fail("Order not found", 404);
    if (!["Pending", "Processing", "In Progress"].includes(order.status)) {
      return fail("Only active orders can be canceled");
    }
    if (!order.service?.cancel) return fail("This service does not support cancellation");
    if (!order.providerOrderId) return fail("Provider order id is missing");

    const result = await cancelProviderOrder(order.provider, order.providerOrderId);

    order.status = "Canceled";
    order.providerResponse = { ...(order.providerResponse ?? {}), cancel: result };
    order.lastStatusSyncAt = new Date();
    await order.save();

    const existingRefund = await WalletTransaction.exists({
      user: auth.id,
      type: "refund",
      source: "order_cancel",
      reference: String(order._id),
    });
    if (!existingRefund && order.sellingPrice > 0) {
      const balanceBefore = dbUser.walletBalance;
      dbUser.walletBalance += order.sellingPrice;
      await dbUser.save();
      await WalletTransaction.create({
        user: auth.id,
        type: "refund",
        amount: order.sellingPrice,
        balanceBefore,
        balanceAfter: dbUser.walletBalance,
        source: "order_cancel",
        reference: String(order._id),
      });
    }

    await notifyInApp({
      user: auth.id,
      title: "Order canceled",
      body: `Order ${order._id} was canceled and refunded.`,
    });

    return ok({ order });
  } catch (error) {
    await logProviderEvent({
      level: "error",
      scope: "api",
      action: "orders.patch",
      message: error instanceof Error ? error.message : "Unable to cancel order",
    });
    return fail(error instanceof Error ? error.message : "Unable to cancel order");
  }
}
