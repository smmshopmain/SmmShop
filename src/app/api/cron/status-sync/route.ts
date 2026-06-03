import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { providerRequest } from "@/lib/provider";
import { Order, Refill } from "@/models";

type StatusResponse = {
  status?: string;
  start_count?: string | number;
  remains?: string | number;
};

export async function GET() {
  try {
    await dbConnect();
    const activeOrders = await Order.find({
      status: { $in: ["Pending", "Processing", "In Progress"] },
      providerOrderId: { $exists: true },
    })
      .populate("provider")
      .limit(100);

    let ordersSynced = 0;
    for (const order of activeOrders) {
      const status = await providerRequest<StatusResponse>(order.provider, {
        action: "status",
        order: order.providerOrderId,
      });
      if (status.status) order.status = status.status;
      if (status.start_count !== undefined) order.startCount = Number(status.start_count);
      if (status.remains !== undefined) order.remains = Number(status.remains);
      order.lastStatusSyncAt = new Date();
      await order.save();
      ordersSynced += 1;
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
