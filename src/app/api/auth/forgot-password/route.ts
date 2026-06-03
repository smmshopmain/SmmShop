import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { buildPasswordOtpEmail, sendMail } from "@/lib/email";
import { createPasswordResetOtp, hashPasswordResetOtp } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";
import { User } from "@/models";

const schema = z.object({ email: z.email() });

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`forgot-password:${ip}`, 5)) return fail("Too many password reset requests", 429);

  try {
    const { email } = await parseBody(request, schema);
    await dbConnect();
    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      const otp = createPasswordResetOtp();
      user.passwordResetTokenHash = hashPasswordResetOtp(normalizedEmail, otp);
      user.passwordResetExpiresAt = new Date(Date.now() + 1000 * 60 * 10);
      user.passwordResetAttempts = 0;
      await user.save();

      const emailContent = buildPasswordOtpEmail(otp);
      await sendMail({
        to: user.email,
        ...emailContent,
      });
    }
    return ok({ message: "If the email exists, an OTP has been sent." });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forgot password failed");
  }
}
