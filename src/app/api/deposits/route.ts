import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { applyDepositDecision, verifyDepositWithGateway } from "@/lib/deposits";
import { notifyInApp } from "@/lib/notifications";
import { Deposit, getSettings } from "@/models";
import { notifyTelegram } from "@/lib/telegram";

const schema = z.object({
  amount: z.number().min(1),
  utr: z.string().min(4).max(80),
  proofUrl: z.string().optional(),
});

export async function GET() {
  try {
    const { auth } = await requireUser();
    const deposits = await Deposit.find({ user: auth.id }).sort({ createdAt: -1 }).lean();
    return ok({ deposits });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load deposits", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    const { auth } = await requireUser();
    const settings = await getSettings();
    const deposit = await Deposit.create({
      user: auth.id,
      amount: input.amount,
      utr: input.utr,
      proofUrl: input.proofUrl,
      mode: settings.deposits.verificationMode,
      verificationStartTime: settings.deposits.verificationStartTime,
      verificationEndTime: settings.deposits.verificationEndTime,
    });

    let automaticVerification = { status: "Pending", message: "Manual review required." };
    if (settings.deposits.verificationMode === "automatic") {
      const decision = await verifyDepositWithGateway(deposit);
      await applyDepositDecision({
        deposit,
        decision,
        source: "deposit_auto_verification",
      });
      automaticVerification = {
        status: decision.status,
        message: decision.message ?? "Automatic verification checked.",
      };
    }

    await notifyTelegram("Deposit Request", [
      `User: ${auth.email}`,
      `Amount: ${input.amount}`,
      `UTR: ${input.utr}`,
    ]);
    await notifyInApp({
      user: auth.id,
      title: "Deposit request submitted",
      body:
        deposit.status === "Pending"
          ? `Rs.${input.amount} deposit with UTR ${input.utr} is pending verification.`
          : `Rs.${input.amount} deposit with UTR ${input.utr} was marked ${deposit.status}.`,
    });

    return ok({
      deposit,
      schedule: {
        start: deposit.verificationStartTime,
        end: deposit.verificationEndTime,
      },
      automaticVerification,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to submit deposit");
  }
}
