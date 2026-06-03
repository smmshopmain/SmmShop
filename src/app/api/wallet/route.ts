import { fail, ok, requireUser } from "@/lib/api";
import { WalletTransaction } from "@/models";

export async function GET() {
  try {
    const { auth, dbUser } = await requireUser();
    const transactions = await WalletTransaction.find({ user: auth.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return ok({ balance: dbUser.walletBalance, frozen: dbUser.walletFrozen, transactions });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load wallet", 401);
  }
}
