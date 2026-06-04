import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { dbConnect } from "@/lib/db";
import { getProviderStatuses, providerRequest } from "@/lib/provider";
import { Order, Refill } from "@/models";

type StatusResponse = {
  status?: string;
  start_count?: string | number;
  remains?: string | number;
};

export async function GET(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  try {
    await dbConnect();
    const activeOrders = await Order.find({
      status: { $in: ["Pending", "Processing", "In Progress"] },
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
      const statuses = await getProviderStatuses(
        provider,
        orders.map((order) => String(order.providerOrderId)),
      );
      for (const order of orders) {
        const status = statuses[String(order.providerOrderId)] as StatusResponse | undefined;
        if (!status) continue;
        if (status.status) order.status = status.status;
        if (status.start_count !== undefined) order.startCount = Number(status.start_count);
        if (status.remains !== undefined) order.remains = Number(status.remains);
        order.lastStatusSyncAt = new Date();
        await order.save();
        ordersSynced += 1;
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
      const result = await providerRequest<{ status?: string }>(refill.provider, {
        action: "refill_status",
        refill: refill.providerRefillId,
      });
      if (result.status) refill.status = result.status;
      refill.lastStatusSyncAt = new Date();
      await refill.save();
      refillsSynced += 1;
    }

    return ok({ ordersSynced, refillsSynced });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Status sync failed");
  }
}
