import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { providerRequest } from "@/lib/provider";
import { Refill } from "@/models";

export async function GET() {
  try {
    await dbConnect();
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

    return ok({ refillsSynced });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Refill sync failed");
  }
}
