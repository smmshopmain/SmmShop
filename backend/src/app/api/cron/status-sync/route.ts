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
  remains?: string | number;
  remains_count?: string | number;
  remaining?: string | number;
  charge?: string | number;
  providerCharge?: string | number;
  provider_charge?: string | number;
};

export async function GET(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  try {
    await dbConnect();
    const activeOrders = await Order.find({
      status: { $in: ["Pending", "Processing", "In Progress", "Partial"] },
      providerOrderId: { $exists: true },
    })
      .populate("provider")
      .limit(100);

    const ordersByProvider = new Map<string, typeof activeOrders>();
    for (const order of activeOrders) {
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
          const status = statuses[String(order.providerOrderId)] as StatusResponse | undefined;
          if (!status) continue;
          const normalizedStatus = normalizeProviderOrderStatus(status.status);
          if (normalizedStatus) order.status = normalizedStatus;
          const startCountValue = status.start_count ?? status.startCount;
          if (startCountValue !== undefined) {
            const startCount = Number(startCountValue);
            if (Number.isFinite(startCount)) order.startCount = startCount;
          }

          const remainsValue = status.remains ?? status.remains_count ?? status.remaining;
          if (remainsValue !== undefined) {
            const remains = Number(remainsValue);
            if (Number.isFinite(remains)) order.remains = remains;
          }

          const providerChargeValue = status.charge ?? status.providerCharge ?? status.provider_charge;
          if (providerChargeValue !== undefined) {
            const providerCharge = Number(providerChargeValue);
            if (Number.isFinite(providerCharge)) {
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
      details: { ordersSynced, refillsSynced },
    });

    return ok({ ordersSynced, refillsSynced });
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
