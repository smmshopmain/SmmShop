import { User, WalletTransaction } from "@/models";

function asMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export async function getEffectiveWalletBalance(
  userId: unknown,
  storedBalance: unknown,
  options: { repairUser?: boolean } = {},
) {
  const stored = asMoney(storedBalance);
  const latestTransaction = await WalletTransaction.findOne({ user: userId })
    .sort({ createdAt: -1 })
    .select("balanceAfter")
    .lean();
  const ledgerBalance = asMoney(latestTransaction?.balanceAfter);
  const hasLedgerBalance = latestTransaction?.balanceAfter !== undefined;
  const balance = hasLedgerBalance ? ledgerBalance : stored;

  if (options.repairUser && balance !== stored) {
    await User.findByIdAndUpdate(userId, { walletBalance: balance });
  }

  return balance;
}
