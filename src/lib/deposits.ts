import { notifyInApp } from "@/lib/notifications";
import { Deposit, User, WalletTransaction } from "@/models";

type DepositDecision = {
  status: "Pending" | "Approved" | "Rejected";
  reference?: string;
  message?: string;
  raw?: unknown;
};

type DepositDoc = {
  _id: unknown;
  depositId?: string;
  user: unknown;
  amount: number;
  utr: string;
  status: "Pending" | "Approved" | "Rejected";
  reviewedBy?: unknown;
  reviewedAt?: Date;
  rejectionReason?: string;
  providerResponse?: unknown;
  save: () => Promise<unknown>;
};

export async function creditDepositWallet({
  userId,
  amount,
  source,
  reference,
  createdBy,
}: {
  userId: unknown;
  amount: number;
  source: string;
  reference: string;
  createdBy?: unknown;
}) {
  const existing = await WalletTransaction.exists({
    user: userId,
    type: "deposit",
    source,
    reference,
  });
  if (existing) return null;

  const user = await User.findById(userId);
  if (!user) throw new Error("Deposit user not found");

  const balanceBefore = user.walletBalance;
  user.walletBalance += amount;
  await user.save();

  return WalletTransaction.create({
    user: user._id,
    type: "deposit",
    amount,
    balanceBefore,
    balanceAfter: user.walletBalance,
    source,
    reference,
    createdBy,
  });
}

export async function applyDepositDecision({
  deposit,
  decision,
  source,
  reviewedBy,
}: {
  deposit: DepositDoc;
  decision: DepositDecision;
  source: string;
  reviewedBy?: unknown;
}) {
  if (deposit.status !== "Pending") return deposit;
  if (decision.status === "Pending") return deposit;

  deposit.status = decision.status;
  deposit.reviewedBy = reviewedBy;
  deposit.reviewedAt = new Date();
  deposit.rejectionReason = decision.status === "Rejected" ? decision.message : undefined;
  await deposit.save();

  if (decision.status === "Approved") {
    await creditDepositWallet({
      userId: deposit.user,
      amount: deposit.amount,
      source,
      reference: decision.reference ?? deposit.depositId ?? String(deposit._id),
      createdBy: reviewedBy,
    });
    await notifyInApp({
      user: deposit.user,
      title: "Deposit approved",
      body: `Rs.${deposit.amount} for deposit ${deposit.depositId ?? deposit._id} has been added to your wallet.`,
    });
  } else {
    await notifyInApp({
      user: deposit.user,
      title: "Deposit rejected",
      body: decision.message || `Deposit ${deposit.depositId ?? deposit._id} was rejected.`,
    });
  }

  return deposit;
}

export async function verifyDepositWithGateway(deposit: {
  _id: unknown;
  depositId?: string;
  utr: string;
  amount: number;
}) {
  const apiUrl = process.env.PAYMENT_VERIFY_API_URL;
  if (!apiUrl) {
    return {
      status: "Pending",
      message: "PAYMENT_VERIFY_API_URL is not configured.",
    } satisfies DepositDecision;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.PAYMENT_VERIFY_API_KEY
        ? { authorization: `Bearer ${process.env.PAYMENT_VERIFY_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      utr: deposit.utr,
      amount: deposit.amount,
      depositId: deposit.depositId ?? String(deposit._id),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Payment verification failed with ${response.status}`);
  }

  const raw = await response.json();
  const providerStatus = String(raw.status ?? raw.paymentStatus ?? "").toLowerCase();
  const verified = raw.verified === true || providerStatus === "success" || providerStatus === "approved";
  const rejected = raw.verified === false || providerStatus === "failed" || providerStatus === "rejected";

  return {
    status: verified ? "Approved" : rejected ? "Rejected" : "Pending",
    reference: raw.reference ?? raw.transactionId ?? raw.id,
    message: raw.message ?? raw.reason,
    raw,
  } satisfies DepositDecision;
}

export async function verifyPendingAutomaticDeposits(limit = 50) {
  const deposits = await Deposit.find({
    status: "Pending",
    mode: "automatic",
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  let approved = 0;
  let rejected = 0;
  let pending = 0;

  for (const deposit of deposits) {
    const decision = await verifyDepositWithGateway(deposit);
    await applyDepositDecision({
      deposit,
      decision,
      source: "deposit_auto_verification",
    });
    if (decision.status === "Approved") approved += 1;
    if (decision.status === "Rejected") rejected += 1;
    if (decision.status === "Pending") pending += 1;
  }

  return { checked: deposits.length, approved, rejected, pending };
}
