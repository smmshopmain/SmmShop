import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { dbConnect } from "@/lib/db";
import {
  getProviderRefillStatus,
  getProviderStatuses,
  logProviderEvent,
  normalizeProviderOrderStatus,
  normalizeProviderRefillStatus,
} from "@/lib/provider";
import { Order, Refill } from "@/models";

type StatusResponse = {
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

function asFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusResponseForOrder(statuses: unknown, providerOrderId: string): StatusResponse | null {
  if (!statuses || typeof statuses !== "object") return null;
  const record = statuses as Record<string, unknown>;
  const direct = record[providerOrderId];
  if (direct && typeof direct === "object") return direct as StatusResponse;

  if ("status" in record || "start_count" in record || "remains" in record || "charge" in record) {
    return record as StatusResponse;
  }

  const nestedKeys = ["data", "result", "response", "orders", "statuses"] as const;
  for (const key of nestedKeys) {
    const nested = statusResponseForOrder(record[key], providerOrderId);
    if (nested) return nested;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  try {
    await dbConnect();
    const syncableStatuses = ["Pending", "Processing", "In Progress", "Partial", "Completed"];
    const activeOrders = await Order.find({
      status: { $in: syncableStatuses },
      providerOrderId: { $exists: true },
    })
      .populate("provider")
      .limit(100);

    const ordersByProvider = new Map<string, typeof activeOrders>();
    let ordersSkipped = 0;
    for (const order of activeOrders) {
      if (!order.provider || !("_id" in order.provider)) {
        ordersSkipped += 1;
        await logProviderEvent({
          level: "warning",
          scope: "status_sync",
          action: "status",
          message: "Skipping order because provider record is missing",
          details: { orderId: String(order._id), providerOrderId: order.providerOrderId, provider: order.provider },
        });
        continue;
      }
      const providerId = String(order.provider._id);
      ordersByProvider.set(providerId, [...(ordersByProvider.get(providerId) ?? []), order]);
    }

    let ordersSynced = 0;
    for (const orders of ordersByProvider.values()) {
      const provider = orders[0].provider;
      try {
        const statuses = await getProviderStatuses(
          provider,
          orders.map((order) => String(order.providerOrderId)),
        );
        for (const order of orders) {
          const status = statusResponseForOrder(statuses, String(order.providerOrderId));
          if (!status) continue;
          const normalizedStatus = normalizeProviderOrderStatus(status.status);
          if (normalizedStatus) order.status = normalizedStatus;
          const startCountValue = status.start_count ?? status.startCount ?? status.start ?? status.start_count_number;
          if (startCountValue !== undefined) {
            const startCount = asFiniteNumber(startCountValue);
            if (startCount !== null) order.startCount = startCount;
          }

          const remainsValue = status.remains ?? status.remains_count ?? status.remaining ?? status.remains_number;
          if (remainsValue !== undefined) {
            const remains = asFiniteNumber(remainsValue);
            if (remains !== null) order.remains = remains;
          }

          const providerChargeValue = status.charge ?? status.providerCharge ?? status.provider_charge;
          if (providerChargeValue !== undefined) {
            const providerCharge = asFiniteNumber(providerChargeValue);
            if (providerCharge !== null) {
              order.providerCharge = providerCharge;
              order.providerCost = providerCharge;
              order.profit = order.sellingPrice - providerCharge;
            }
          }
          order.lastStatusSyncAt = new Date();
          order.providerResponse = { ...(order.providerResponse ?? {}), lastStatus: status };
          await order.save();
          ordersSynced += 1;
        }
      } catch (error) {
        await logProviderEvent({
          provider,
          level: "error",
          scope: "status_sync",
          action: "status",
          message: error instanceof Error ? error.message : "Order status sync failed",
          details: { orderCount: orders.length },
        });
      }
    }

    const activeRefills = await Refill.find({
      status: { $in: ["Pending", "Processing"] },
      providerRefillId: { $exists: true },
    })
      .populate("provider")
      .limit(100);

    let refillsSynced = 0;
    for (const refill of activeRefills) {
      try {
        const result = await getProviderRefillStatus(refill.provider, String(refill.providerRefillId));
        const normalizedStatus = normalizeProviderRefillStatus(result.status);
        if (normalizedStatus) refill.status = normalizedStatus;
        refill.lastStatusSyncAt = new Date();
        refill.providerResponse = { ...(refill.providerResponse ?? {}), lastStatus: result };
        await refill.save();
        refillsSynced += 1;
      } catch (error) {
        await logProviderEvent({
          provider: refill.provider,
          level: "error",
          scope: "refill_sync",
          action: "refill_status",
          message: error instanceof Error ? error.message : "Refill status sync failed",
          details: { refill: refill.providerRefillId },
        });
      }
    }

    await logProviderEvent({
      scope: "status_sync",
      action: "status",
      message: `Synced ${ordersSynced} orders and ${refillsSynced} refills`,
      details: { ordersSynced, refillsSynced, ordersSkipped },
    });

    return ok({ ordersSynced, refillsSynced, ordersSkipped });
  } catch (error) {
    await logProviderEvent({
      level: "error",
      scope: "status_sync",
      action: "status",
      message: error instanceof Error ? error.message : "Status sync failed",
    });
    return fail(error instanceof Error ? error.message : "Status sync failed");
  }
}
