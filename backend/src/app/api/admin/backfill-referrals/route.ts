import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { User, getSettings } from "@/models";
import { createUniqueReferralCode } from "@/lib/referral-code";

export async function POST() {
  try {
    await requireAdmin();
    await dbConnect();

    const users = await User.find({ $or: [{ referralCode: { $exists: false } }, { referralCode: null }, { referralCode: "" }] });
    let updated = 0;
    for (const user of users) {
      if (!user.referralCode) {
        user.referralCode = await createUniqueReferralCode(User);
        await user.save();
        updated += 1;
      }
    }

    return ok({ updated, totalChecked: users.length });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to backfill referrals");
  }
}
