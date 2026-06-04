import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { hashPasswordResetOtp } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";
import { User } from "@/models";

const schema = z.object({
  email: z.email(),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6 digit OTP"),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!(await rateLimit(`reset-password:${ip}`, 10))) return fail("Too many reset attempts", 429);

  try {
    const input = await parseBody(request, schema);
    const email = input.email.toLowerCase();
    await dbConnect();

    const user = await User.findOne({ email });
    if (
      !user ||
      !user.passwordResetTokenHash ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      return fail("OTP is invalid or expired", 400);
    }

    if ((user.passwordResetAttempts ?? 0) >= 5) {
      user.passwordResetTokenHash = undefined;
      user.passwordResetExpiresAt = undefined;
      user.passwordResetAttempts = 0;
      await user.save();
      return fail("OTP attempt limit exceeded. Request a new OTP.", 400);
    }

    const otpHash = hashPasswordResetOtp(email, input.otp);
    if (otpHash !== user.passwordResetTokenHash) {
      user.passwordResetAttempts = (user.passwordResetAttempts ?? 0) + 1;
      await user.save();
      return fail("OTP is invalid or expired", 400);
    }

    user.passwordHash = await hashPassword(input.newPassword);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.passwordResetAttempts = 0;
    await user.save();

    return ok({ changed: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to reset password");
  }
}
