import { fail, ok, requireUser } from "@/lib/api";
import { WalletTransaction } from "@/models";
import { getEffectiveWalletBalance } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { auth, dbUser } = await requireUser();
    const balance = await getEffectiveWalletBalance(auth.id, dbUser.walletBalance, { repairUser: true });
    const transactions = await WalletTransaction.find({ user: auth.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return ok({ balance, frozen: dbUser.walletFrozen, transactions });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load wallet", 401);
  }
}
