import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { applyDepositDecision, notifyTelegramDepositRequest, verifyDepositWithGateway } from "@/lib/deposits";
import { notifyInApp } from "@/lib/notifications";
import { Deposit, getSettings } from "@/models";
import { publicOrigin } from "@/lib/request-origin";

const schema = z.object({
  amount: z.number().min(1),
  utr: z.string().min(4).max(80),
  proofUrl: z.string().min(1, "Payment screenshot is required"),
});

function makeDepositId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DEP-${date}-${random}`;
}

async function createDeposit(input: {
  user: string;
  amount: number;
  utr: string;
  proofUrl?: string;
  mode: string;
  verificationStartTime: string;
  verificationEndTime: string;
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await Deposit.create({
        ...input,
        depositId: makeDepositId(),
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: number }).code === 11000
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unable to generate unique deposit ID");
}

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
    const { auth, dbUser } = await requireUser();
    const settings = await getSettings();
    if (settings.deposits.minimumWalletAddAmount > 0 && input.amount < settings.deposits.minimumWalletAddAmount) {
      return fail(`Minimum wallet top-up amount is ₹${settings.deposits.minimumWalletAddAmount}.`);
    }
    const deposit = await createDeposit({
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

    await notifyTelegramDepositRequest({
      deposit,
      user: { _id: dbUser._id, name: dbUser.name, email: dbUser.email },
      origin: publicOrigin(request),
    });
    await notifyInApp({
      user: auth.id,
      title: "Deposit request submitted",
      body:
        deposit.status === "Pending"
          ? `Rs.${input.amount} deposit ${deposit.depositId} with UTR ${input.utr} is pending verification.`
          : `Rs.${input.amount} deposit ${deposit.depositId} with UTR ${input.utr} was marked ${deposit.status}.`,
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
