import { NextRequest } from "next/server";
import { fail, ok, requireUser } from "@/lib/api";
import { WalletTransaction } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { auth, dbUser } = await requireUser();
    const searchParams = request.nextUrl.searchParams;
    const summaryOnly = searchParams.get("summary") === "1";
    const requestedLimit = Number(searchParams.get("limit"));
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 100;
    const transactions = summaryOnly
      ? []
      : await WalletTransaction.find({ user: auth.id })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
    return ok({ balance: dbUser.walletBalance, frozen: dbUser.walletFrozen, transactions });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load wallet", 401);
  }
}
