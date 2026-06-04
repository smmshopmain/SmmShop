import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { applyDepositDecision } from "@/lib/deposits";
import { AuditLog, Deposit } from "@/models";

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

    await applyDepositDecision({
      deposit,
      decision: {
        status: action === "approve" ? "Approved" : "Rejected",
        message: body.rejectionReason,
      },
      source: action === "approve" ? "deposit_approved" : "deposit_rejected",
      reviewedBy: auth.id,
      adminAction: action === "approve" ? "web_approve" : "web_reject",
    });

    await AuditLog.create({ actor: auth.id, action: `deposit.${action}`, entity: "Deposit", entityId: id });
    return ok({ deposit });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to review deposit");
  }
}
