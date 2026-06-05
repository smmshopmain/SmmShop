import { requireUser, ok, fail } from "@/lib/api";
import { Referral } from "@/models";

export async function GET() {
  try {
    const { auth } = await requireUser();
    const history = await Referral.find({ referrer: auth.id })
      .populate("referredUser", "name email")
      .sort({ updatedAt: -1 })
      .lean();

    return ok({ history });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load referrals", 401);
  }
}
