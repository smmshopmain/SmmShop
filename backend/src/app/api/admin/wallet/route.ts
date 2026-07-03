import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, parseBody, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { AuditLog, User, WalletTransaction } from "@/models";
import { notifyInApp } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const schema = z.object({
  userId: z.string().min(1),
  action: z.enum(["add", "deduct", "set"]),
  amount: z.coerce.number().finite().min(0),
  note: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const input = await parseBody(request, schema);
    if ((input.action === "add" || input.action === "deduct") && input.amount <= 0) {
      return fail("Amount must be greater than 0.");
    }
    const user = await User.findById(input.userId);
    if (!user) return fail("User not found", 404);
    const balanceBefore = Number(user.walletBalance ?? 0);
    if (input.action === "add") user.walletBalance = balanceBefore + input.amount;
    if (input.action === "deduct") user.walletBalance = Math.max(0, balanceBefore - input.amount);
    if (input.action === "set") user.walletBalance = input.amount;
    await user.save();
    const adjustmentAmount = Number(user.walletBalance) - balanceBefore;
    await WalletTransaction.create({
      user: user._id,
      type: "admin_adjustment",
      amount: adjustmentAmount,
      balanceBefore,
      balanceAfter: user.walletBalance,
      source: `admin_${input.action}`,
      note: input.note?.trim(),
      createdBy: auth.id,
    });
    await notifyInApp({
      user: user._id,
      title: "Wallet balance updated",
      body: `Admin ${input.action === "set" ? "set your wallet balance to" : input.action === "add" ? "added" : "deducted"} Rs.${Math.abs(input.action === "set" ? user.walletBalance : adjustmentAmount)}.`,
    });
    await AuditLog.create({
      actor: auth.id,
      action: `wallet.${input.action}`,
      entity: "User",
      entityId: input.userId,
      before: { walletBalance: balanceBefore },
      after: { walletBalance: user.walletBalance },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/wallet");
    revalidatePath("/admin/users");
    return ok({ balance: user.walletBalance, adjustmentAmount });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update wallet");
  }
}
