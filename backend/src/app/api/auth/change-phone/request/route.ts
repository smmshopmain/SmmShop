import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { buildPhoneChangeOtpEmail, sendMail } from "@/lib/email";
import { createPasswordResetOtp, hashPhoneChangeOtp } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";
import { User } from "@/models";

const schema = z.object({
  phone: z.string().trim().min(6).max(25),
});

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    const { auth, dbUser } = await requireUser();
    const nextPhone = input.phone;

    if (!(await rateLimit(`phone-change-request:${auth.id}`, 5))) {
      return fail("Too many phone change requests", 429);
    }

    if (nextPhone === (dbUser.phone ?? "")) return fail("Enter a different phone number", 400);

    const existing = await User.findOne({ phone: nextPhone, _id: { $ne: dbUser._id } });
    if (existing) return fail("Phone number is already in use", 409);

    const otp = createPasswordResetOtp();
    dbUser.phoneChangeNewPhone = nextPhone;
    dbUser.phoneChangeTokenHash = hashPhoneChangeOtp(auth.id, nextPhone, otp);
    dbUser.phoneChangeExpiresAt = new Date(Date.now() + 1000 * 60 * 10);
    dbUser.phoneChangeAttempts = 0;
    await dbUser.save();

    await sendMail({
      to: dbUser.email,
      ...buildPhoneChangeOtpEmail(otp),
    });

    return ok({ message: "OTP sent to your current email address." });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to send phone change OTP");
  }
}
