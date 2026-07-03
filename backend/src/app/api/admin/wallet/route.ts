import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { AuditLog, User, WalletTransaction } from "@/models";

const schema = z.object({
  userId: z.string().min(1),
  action: z.enum(["add", "deduct", "set"]),
  amount: z.number().min(0),
  note: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const input = await parseBody(request, schema);
    const user = await User.findById(input.userId);
    if (!user) return fail("User not found", 404);
    const balanceBefore = user.walletBalance;
    if (input.action === "add") user.walletBalance += input.amount;
    if (input.action === "deduct") user.walletBalance = Math.max(0, user.walletBalance - input.amount);
    if (input.action === "set") user.walletBalance = input.amount;
    await user.save();
    await WalletTransaction.create({
      user: user._id,
      type: "admin_adjustment",
      amount: user.walletBalance - balanceBefore,
      balanceBefore,
      balanceAfter: user.walletBalance,
      source: `admin_${input.action}`,
      note: input.note,
      createdBy: auth.id,
    });
    await AuditLog.create({ actor: auth.id, action: `wallet.${input.action}`, entity: "User", entityId: input.userId });
    return ok({ balance: user.walletBalance });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update wallet");
  }
}
