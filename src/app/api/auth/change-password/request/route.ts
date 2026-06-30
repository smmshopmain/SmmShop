import { fail, ok, requireUser } from "@/lib/api";
import { buildPasswordChangeOtpEmail, sendMail } from "@/lib/email";
import { createPasswordResetOtp, hashPasswordChangeOtp } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";

export async function POST() {
  try {
    const { auth, dbUser } = await requireUser();

    if (!(await rateLimit(`password-change-request:${auth.id}`, 5))) {
      return fail("Too many password change requests", 429);
    }

    const otp = createPasswordResetOtp();
    dbUser.passwordChangeTokenHash = hashPasswordChangeOtp(auth.id, otp);
    dbUser.passwordChangeExpiresAt = new Date(Date.now() + 1000 * 60 * 10);
    dbUser.passwordChangeAttempts = 0;
    await dbUser.save();

    await sendMail({
      to: dbUser.email,
      ...buildPasswordChangeOtpEmail(otp),
    });

    return ok({ message: "OTP sent to your current email address." });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to send password change OTP");
  }
}
