import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { notifyTelegram } from "@/lib/telegram";
import { Deposit, User, WalletTransaction } from "@/models";

const schema = z.object({
  utr: z.string().min(4),
  amount: z.number().min(1),
  status: z.enum(["Approved", "Rejected"]),
  reference: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  if (process.env.JWT_SECRET && secret !== process.env.JWT_SECRET) {
    return fail("Invalid webhook secret", 401);
  }

  try {
    await dbConnect();
    const input = schema.parse(await request.json());
    const deposit = await Deposit.findOne({ utr: input.utr, amount: input.amount, status: "Pending" });
    if (!deposit) return fail("Pending deposit not found", 404);

    deposit.status = input.status;
    deposit.reviewedAt = new Date();
    await deposit.save();

    if (input.status === "Approved") {
      const user = await User.findById(deposit.user);
      if (!user) return fail("Deposit user not found", 404);
      const balanceBefore = user.walletBalance;
      user.walletBalance += deposit.amount;
      await user.save();
      await WalletTransaction.create({
        user: user._id,
        type: "deposit",
        amount: deposit.amount,
        balanceBefore,
        balanceAfter: user.walletBalance,
        source: "deposit_webhook",
        reference: input.reference ?? String(deposit._id),
      });
    }

    await notifyTelegram(`Deposit ${input.status}`, [`UTR: ${input.utr}`, `Amount: ${input.amount}`]);
    return ok({ deposit });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Deposit webhook failed");
  }
}
