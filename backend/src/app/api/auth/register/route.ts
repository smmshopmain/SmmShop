import { NextRequest } from "next/server";
import { z } from "zod";
import { parseBody, fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { createUniqueReferralCode } from "@/lib/referral-code";
import { User, Referral, getSettings } from "@/models";
import { notifyTelegram } from "@/lib/telegram";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.email(),
  password: z.string().min(8),
  referralCode: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    await dbConnect();

    const exists = await User.exists({ email: input.email.toLowerCase() });
    if (exists) return fail("Email is already registered", 409);

    const isFirstAdmin = !(await User.exists({ role: "admin" }));
    const settings = await getSettings();
    const referralSystemEnabled = settings.referrals.enabled !== false;
    const requestedReferralCode = referralSystemEnabled ? input.referralCode?.trim().toUpperCase() : "";
    const referrer = referralSystemEnabled && requestedReferralCode
      ? await User.findOne({ referralCode: requestedReferralCode })
      : null;
    const referralCode = await createUniqueReferralCode(User);
    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: isFirstAdmin ? "admin" : "user",
      referralCode,
      referredBy: referralSystemEnabled && referrer ? referrer._id : undefined,
    });

    if (referralSystemEnabled && referrer) {
      await Referral.create({ referrer: referrer._id, referredUser: user._id });
    }

    await setSessionCookie({
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
    });
    await notifyTelegram("New User Registration", [user.email, `Role: ${user.role}`]);

    return ok({ id: user._id, name: user.name, email: user.email, role: user.role, referralCode: user.referralCode });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Registration failed");
  }
}
