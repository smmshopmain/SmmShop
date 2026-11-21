import { NextRequest } from "next/server";
import mongoose from "mongoose";
import {
  getApiDiscount,
  refreshOwnedOrderStatus,
  placeResellerOrder,
  publicService,
  readApiInput,
  ResellerApiError,
  runResellerApiRequest,
} from "@/lib/reseller-api";
import { drainOrderQueueLocked, OrderQueueBusyError, withOrderQueueLock } from "@/lib/order-queue";
import {
  getProviderRefillStatus,
  normalizeProviderRefillStatus,
  requestProviderRefill,
  tryCancelProviderOrder,
} from "@/lib/provider";
import { Order, Refill, Service } from "@/models";

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export async function POST(request: NextRequest) {
  let input: Record<string, unknown>;
  try {
    input = await readApiInput(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid API request.";
    const status = error instanceof ResellerApiError ? error.status : 400;
    const code = error instanceof ResellerApiError ? error.code : "INVALID_REQUEST";
    return Response.json({ error: message, code }, { status });
  }
  const action = typeof input.action === "string" ? input.action.trim().toLowerCase() : "";

  return runResellerApiRequest(request, "standard", input, action, async (context) => {
    if (action === "services") {
      const discount = getApiDiscount(context);
      const services = await Service.find({ active: true })
        .populate({ path: "provider", match: { enabled: true }, select: "_id" })
        .sort({ category: 1, name: 1 })
        .limit(1000)
        .lean();
      return services
        .filter((service) => service.provider)
        .map((service) => publicService(service, discount));
    }

    if (action === "balance") {
      return { balance: Number(context.user.walletBalance ?? 0).toFixed(2), currency: "INR" };
    }

    if (action === "add") {
      const serviceId = String(input.service ?? "");
      const link = String(input.link ?? "");
      const quantity = numberValue(input.quantity);
      if (!serviceId || !link || !Number.isInteger(quantity) || quantity <= 0) {
        throw new ResellerApiError("INVALID_REQUEST", "Provide service, link, and a positive integer quantity.", 400);
      }
      const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
      const order = await placeResellerOrder(context, { serviceId, link, quantity, idempotencyKey });
      return { order: order.order };
    }

    if (action === "status") {
      const orderId = String(input.order ?? "");
      if (!orderId) throw new ResellerApiError("INVALID_REQUEST", "Provide an order ID.", 400);
      return refreshOwnedOrderStatus(context.user._id, orderId, context.settings.api.providerTimeoutMs);
    }

    if (action === "multi_status") {
      const rawOrders = String(input.orders ?? "");
      const orderIds = [...new Set(rawOrders.split(",").map((id) => id.trim()).filter(Boolean))];
      if (orderIds.length === 0 || orderIds.length > 100) {
        throw new ResellerApiError("INVALID_REQUEST", "Provide between 1 and 100 comma-separated order IDs.", 400);
      }
      const orders = await Order.find({ user: context.user._id, _id: { $in: orderIds } })
        .select("_id status sellingPrice startCount remains createdAt updatedAt lastStatusSyncAt")
        .lean();
      return Object.fromEntries(orders.map((order) => [
        String(order._id),
        {
          status: order.status,
          charge: order.sellingPrice,
          start_count: order.startCount ?? null,
          remains: order.remains ?? null,
          created_at: order.createdAt,
          updated_at: order.updatedAt,
          last_verified_at: order.lastStatusSyncAt ?? null,
        },
      ]));
    }

    if (action === "cancel") {
      const orderId = String(input.order ?? "");
      if (!mongoose.isValidObjectId(orderId)) throw new ResellerApiError("ORDER_NOT_FOUND", "Order not found.", 404);
      const existing = await Order.findOne({ _id: orderId, user: context.user._id }).select("link");
      if (!existing) throw new ResellerApiError("ORDER_NOT_FOUND", "Order not found.", 404);
      try {
        const canceled = await withOrderQueueLock(String(context.user._id), existing.link, async (queue) => {
          const order = await Order.findOne({ _id: orderId, user: context.user._id }).populate("provider");
          if (!order) throw new ResellerApiError("ORDER_NOT_FOUND", "Order not found.", 404);
          const wasScheduled = order.status === "Scheduled";
          if (!wasScheduled && !["Pending", "Processing", "In Progress"].includes(order.status)) {
            throw new ResellerApiError("ORDER_NOT_CANCELLABLE", "Only active or scheduled orders can be canceled.", 409);
          }
          if (wasScheduled) {
            order.status = "Canceled";
          } else {
            queue.activeOrder = order._id;
            await queue.save();
          }
          let attempt = { attempted: false, accepted: false };
          if (!wasScheduled && order.providerOrderId && order.provider) {
            attempt = await tryCancelProviderOrder(order.provider, order.providerOrderId, context.settings.api.providerTimeoutMs);
          }
          order.providerResponse = {
            ...(order.providerResponse ?? {}),
            cancellationAttempt: { ...attempt, attemptedAt: new Date() },
          };
          order.lastStatusSyncAt = new Date();
          await order.save();
          await drainOrderQueueLocked(queue);
          return order;
        });
        return { cancel: [String(canceled._id)], status: canceled.status };
      } catch (error) {
        if (error instanceof OrderQueueBusyError) {
          throw new ResellerApiError("ORDER_BUSY", error.message, 409);
        }
        throw error;
      }
    }

    if (action === "refill") {
      const orderId = String(input.order ?? "");
      if (!mongoose.isValidObjectId(orderId)) throw new ResellerApiError("ORDER_NOT_FOUND", "Order not found.", 404);
      const order = await Order.findOne({ _id: orderId, user: context.user._id })
        .populate("provider")
        .populate("service");
      if (!order) throw new ResellerApiError("ORDER_NOT_FOUND", "Order not found.", 404);
      if (!order.service.refill) throw new ResellerApiError("UNSUPPORTED_OPERATION", "This service does not support refills.", 400);
      if (!order.providerOrderId) throw new ResellerApiError("ORDER_NOT_SUBMITTED", "The order has not been submitted to the provider.", 409);
      const result = await requestProviderRefill(order.provider, order.providerOrderId, context.settings.api.providerTimeoutMs);
      const refill = await Refill.create({
        user: context.user._id,
        order: order._id,
        provider: order.provider._id,
        providerRefillId: result.refill ? String(result.refill) : undefined,
        providerResponse: result,
      });
      return { refill: String(refill._id), providerRefillId: refill.providerRefillId ?? null };
    }

    if (action === "refill_status") {
      const refillId = String(input.refill ?? "");
      if (!mongoose.isValidObjectId(refillId)) throw new ResellerApiError("REFILL_NOT_FOUND", "Refill not found.", 404);
      const refill = await Refill.findOne({ _id: refillId, user: context.user._id }).populate("provider");
      if (!refill) throw new ResellerApiError("REFILL_NOT_FOUND", "Refill not found.", 404);
      if (!refill.providerRefillId) return { refill: String(refill._id), status: refill.status };
      if (!refill.lastStatusSyncAt || Date.now() - refill.lastStatusSyncAt.getTime() >= 60_000) {
        const result = await getProviderRefillStatus(refill.provider, refill.providerRefillId, context.settings.api.providerTimeoutMs);
        const status = normalizeProviderRefillStatus(result.status);
        if (status) refill.status = status;
        refill.providerResponse = { ...(refill.providerResponse ?? {}), lastStatus: result };
        refill.lastStatusSyncAt = new Date();
        await refill.save();
      }
      return { refill: String(refill._id), status: refill.status };
    }
    throw new ResellerApiError("INVALID_ACTION", "Unsupported API action.", 400);
  });
}
