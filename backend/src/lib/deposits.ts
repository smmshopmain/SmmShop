import { notifyInApp } from "@/lib/notifications";
import { roundMoney } from "@/lib/pricing";
import { Deposit, Referral, User, WalletTransaction, getSettings } from "@/models";
import {
  ensureTelegramWebhook,
  notifyTelegram,
  sendTelegramAttachment,
  sendTelegramMessage,
} from "@/lib/telegram";

export const TELEGRAM_REJECT_REASONS: Record<string, string> = {
  invalid_utr: "Invalid UTR",
  payment_not_found: "Payment Not Found",
  wrong_amount: "Wrong Amount",
  duplicate_payment: "Duplicate Payment",
  other: "Other",
};

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
  adminAction?: string;
  adminTelegramId?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  providerResponse?: unknown;
  save: () => Promise<unknown>;
};

type WalletUserDoc = {
  _id: unknown;
  name?: string;
  walletBalance: number;
  referralEarnings: number;
  referredBy?: unknown;
  save: () => Promise<unknown>;
};

async function maybeCreditReferralTopUpBonus({
  user,
  depositAmount,
}: {
  user: WalletUserDoc;
  depositAmount: number;
}) {
  if (!user.referredBy) return;

  const settings = await getSettings();
  if (settings.referrals.enabled === false) return;

  const minimumTopUp = Number(settings.referrals.minimumReferredWalletAddAmount ?? 0);
  const [summary] = await WalletTransaction.aggregate([
    { $match: { user: user._id, type: "deposit" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const totalTopUp = Number(summary?.total ?? 0);
  if (totalTopUp < Math.max(0, minimumTopUp)) return;

  const existingReferral = await Referral.findOne({
    referrer: user.referredBy,
    referredUser: user._id,
  });
  if (existingReferral?.status === "Paid") return;

  const existingPayout = await WalletTransaction.exists({
    user: user.referredBy,
    type: "referral",
    source: "referral_wallet_topup_bonus",
    reference: String(user._id),
  });
  if (existingPayout) {
    await Referral.findOneAndUpdate(
      { referrer: user.referredBy, referredUser: user._id },
      { status: "Paid" },
      { upsert: true },
    );
    return;
  }

  const commissionAmount = Number(settings.referrals.commissionAmount ?? 0);
  const commissionPercent = Number(settings.referrals.commissionPercent ?? 0);
  const commission =
    commissionAmount > 0
      ? roundMoney(commissionAmount)
      : commissionPercent > 0
        ? roundMoney((depositAmount * commissionPercent) / 100)
        : 0;
  if (commission <= 0) return;

  const referrer = await User.findById(user.referredBy);
  if (!referrer) return;

  const balanceBefore = referrer.walletBalance;
  referrer.walletBalance += commission;
  referrer.referralEarnings += commission;
  await referrer.save();

  await WalletTransaction.create({
    user: referrer._id,
    type: "referral",
    amount: commission,
    balanceBefore,
    balanceAfter: referrer.walletBalance,
    source: "referral_wallet_topup_bonus",
    reference: String(user._id),
  });
  await Referral.findOneAndUpdate(
    { referrer: referrer._id, referredUser: user._id },
    { $inc: { earnings: commission }, status: "Paid" },
    { upsert: true, returnDocument: "after" },
  );
  await notifyInApp({
    user: referrer._id,
    title: "Referral bonus credited",
    body: `Rs.${commission} credited after ${user.name ?? "referred user"} added wallet balance.`,
  });
}

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

  const transaction = await WalletTransaction.create({
    user: user._id,
    type: "deposit",
    amount,
    balanceBefore,
    balanceAfter: user.walletBalance,
    source,
    reference,
    createdBy,
  });

  try {
    await maybeCreditReferralTopUpBonus({ user, depositAmount: amount });
  } catch (error) {
    console.error("Referral top-up bonus failed", error);
  }

  return transaction;
}

export async function applyDepositDecision({
  deposit,
  decision,
  source,
  reviewedBy,
  adminAction,
  adminTelegramId,
}: {
  deposit: DepositDoc;
  decision: DepositDecision;
  source: string;
  reviewedBy?: unknown;
  adminAction?: string;
  adminTelegramId?: string;
}) {
  if (deposit.status !== "Pending") return deposit;
  if (decision.status === "Pending") return deposit;

  deposit.status = decision.status;
  deposit.reviewedBy = reviewedBy;
  deposit.adminAction = adminAction;
  deposit.adminTelegramId = adminTelegramId;
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
      title: "✅ Deposit Approved",
      body: `Amount: ₹${deposit.amount}\n\nFunds successfully added to your wallet.`,
    });
    await notifyTelegram("✅ Deposit Approved", [
      `Deposit: ${deposit.depositId ?? deposit._id}`,
      `Amount: ₹${deposit.amount}`,
      "Funds credited to user wallet.",
    ]);
  } else {
    await notifyInApp({
      user: deposit.user,
      title: "❌ Deposit Rejected",
      body: `Reason: ${decision.message || "Other"}`,
    });
    await notifyTelegram("❌ Deposit Rejected", [
      `Deposit: ${deposit.depositId ?? deposit._id}`,
      `Amount: ₹${deposit.amount}`,
      `Reason: ${decision.message || "Other"}`,
    ]);
  }

  return deposit;
}

export function depositTelegramKeyboard(depositMongoId: unknown) {
  const id = String(depositMongoId);
  return {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: `dep:approve:${id}` },
        { text: "❌ Reject", callback_data: `dep:reject:${id}` },
      ],
    ],
  };
}

export function depositRejectReasonKeyboard(depositMongoId: unknown) {
  const id = String(depositMongoId);
  return {
    inline_keyboard: [
      [{ text: "Invalid UTR", callback_data: `dep:reason:${id}:invalid_utr` }],
      [{ text: "Payment Not Found", callback_data: `dep:reason:${id}:payment_not_found` }],
      [{ text: "Wrong Amount", callback_data: `dep:reason:${id}:wrong_amount` }],
      [{ text: "Duplicate Payment", callback_data: `dep:reason:${id}:duplicate_payment` }],
      [{ text: "Other", callback_data: `dep:reason:${id}:other` }],
    ],
  };
}

export function makeAbsoluteUrl(value: string, origin?: string) {
  if (/^https?:\/\//i.test(value)) return value;
  const base = process.env.APP_BASE_URL || origin;
  if (!base) return value;
  return new URL(value, base).toString();
}

export async function notifyTelegramDepositRequest({
  deposit,
  user,
  origin,
}: {
  deposit: {
    _id: unknown;
    depositId?: string;
    amount: number;
    utr: string;
    proofUrl?: string;
    status: string;
    createdAt?: Date;
  };
  user: { _id: unknown; name?: string; email?: string };
  origin?: string;
}) {
  await ensureTelegramWebhook(origin);

  const createdAt = deposit.createdAt ? new Date(deposit.createdAt) : new Date();
  const message = [
    "💰 New Deposit Request",
    "",
    `Request ID: ${deposit.depositId ?? deposit._id}`,
    "",
    `User ID: USER-${String(user._id).slice(-6).toUpperCase()}`,
    `Username: ${user.name ?? "User"}`,
    `Email: ${user.email ?? "-"}`,
    "",
    `Amount: ₹${deposit.amount}`,
    `UTR: ${deposit.utr}`,
    "",
    `Date: ${createdAt.toLocaleDateString("en-IN")}`,
    `Time: ${createdAt.toLocaleTimeString("en-IN")}`,
    "",
    `Status: ${deposit.status}`,
    "",
    "Screenshot Attached",
    "",
    "Use /pending in Telegram to list all pending deposit requests.",
  ].join("\n");

  const replyMarkup = depositTelegramKeyboard(deposit._id);
  if (deposit.proofUrl) {
    const fileUrl = makeAbsoluteUrl(deposit.proofUrl, origin);
    if (/^https?:\/\//i.test(fileUrl)) {
      await sendTelegramAttachment({
        caption: message,
        fileUrl,
        replyMarkup,
      });
      return;
    }
  }

  await sendTelegramMessage({ text: message, replyMarkup });
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
