import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireAdmin } from "@/lib/api";
import { buildEmailChangeOtpEmail, sendMail } from "@/lib/email";
import { createPasswordResetOtp, hashEmailChangeOtp } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";
import { User } from "@/models";

const schema = z.object({
  email: z.email(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!(await rateLimit(`admin-email-change-request:${ip}`, 5))) {
    return fail("Too many email change requests", 429);
  }

  try {
    const { email } = await parseBody(request, schema);
    const { auth, dbUser } = await requireAdmin();
    const nextEmail = email.toLowerCase();

    if (nextEmail === dbUser.email) return fail("Enter a different email address", 400);

    const existing = await User.findOne({ email: nextEmail, _id: { $ne: dbUser._id } });
    if (existing) return fail("Email is already registered", 409);

    const otp = createPasswordResetOtp();
    dbUser.emailChangeNewEmail = nextEmail;
    dbUser.emailChangeTokenHash = hashEmailChangeOtp(auth.id, nextEmail, otp);
    dbUser.emailChangeExpiresAt = new Date(Date.now() + 1000 * 60 * 10);
    dbUser.emailChangeAttempts = 0;
    await dbUser.save();

    await sendMail({
      to: nextEmail,
      ...buildEmailChangeOtpEmail(otp),
    });

    return ok({ message: "OTP sent to the new email address." });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to send email change OTP");
  }
}
