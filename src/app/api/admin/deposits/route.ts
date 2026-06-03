import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { AuditLog, Deposit, User, WalletTransaction } from "@/models";
import { notifyTelegram } from "@/lib/telegram";

export async function GET() {
  try {
    await requireAdmin();
    const deposits = await Deposit.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return ok({ deposits });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load deposits", 403);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    const body = await request.json();
    const id = z.string().parse(body.id);
    const action = z.enum(["approve", "reject"]).parse(body.action);
    const deposit = await Deposit.findById(id);
    if (!deposit) return fail("Deposit not found", 404);
    if (deposit.status !== "Pending") return fail("Deposit already reviewed");

    deposit.status = action === "approve" ? "Approved" : "Rejected";
    deposit.reviewedBy = auth.id;
    deposit.reviewedAt = new Date();
    deposit.rejectionReason = body.rejectionReason;
    await deposit.save();

    if (action === "approve") {
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
        source: "deposit_approved",
        reference: String(deposit._id),
        createdBy: auth.id,
      });
    }

    await AuditLog.create({ actor: auth.id, action: `deposit.${action}`, entity: "Deposit", entityId: id });
    await notifyTelegram(action === "approve" ? "Deposit Approval" : "Deposit Rejection", [`Deposit: ${id}`]);
    return ok({ deposit });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to review deposit");
  }
}
