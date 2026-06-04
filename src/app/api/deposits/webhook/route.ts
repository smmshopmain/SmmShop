import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { applyDepositDecision } from "@/lib/deposits";
import { notifyTelegram } from "@/lib/telegram";
import { Deposit } from "@/models";

const schema = z.object({
  utr: z.string().min(4),
  amount: z.number().min(1),
  status: z.enum(["Approved", "Rejected"]),
  reference: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  if (process.env.PAYMENT_WEBHOOK_SECRET && secret !== process.env.PAYMENT_WEBHOOK_SECRET) {
    return fail("Invalid webhook secret", 401);
  }

  try {
    await dbConnect();
    const input = schema.parse(await request.json());
    const deposit = await Deposit.findOne({ utr: input.utr, amount: input.amount, status: "Pending" });
    if (!deposit) return fail("Pending deposit not found", 404);

    await applyDepositDecision({
      deposit,
      decision: {
        status: input.status,
        reference: input.reference,
      },
      source: "deposit_webhook",
    });

    await notifyTelegram(`Deposit ${input.status}`, [`UTR: ${input.utr}`, `Amount: ${input.amount}`]);
    return ok({ deposit });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Deposit webhook failed");
  }
}
