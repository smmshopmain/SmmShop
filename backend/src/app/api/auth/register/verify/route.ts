import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { setSessionCookie } from "@/lib/auth";
import { recordLoginSession } from "@/lib/login-session";
import { createUniqueReferralCode } from "@/lib/referral-code";
import { hashRegistrationOtp } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";
import { dbConnect } from "@/lib/db";
import { sendWelcomeEmail, welcomeEmailFailureMessage } from "@/lib/welcome-email";
import { notifyTelegram } from "@/lib/telegram";
import { PendingRegistration, Referral, User, getSettings } from "@/models";

const schema = z.object({
  email: z.email().transform((email) => email.trim().toLowerCase()),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6 digit OTP"),
});

function hashesMatch(expectedHash: string, actualHash: string) {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const input = await parseBody(request, schema);
    if (!(await rateLimit(`register-verify-ip:${ip}`, 10, 10 * 60_000))) {
      return fail("Too many verification attempts. Please try again later.", 429);
    }
    if (!(await rateLimit(`register-verify-email:${input.email}`, 5, 10 * 60_000))) {
      return fail("Too many verification attempts. Please request a new code later.", 429);
    }

    await dbConnect();
    const pending = await PendingRegistration.findOne({
      email: input.email,
      expiresAt: { $gt: new Date() },
    });
    if (!pending) {
      return fail("Verification code is invalid or expired. Request a new code.", 400);
    }
    if (!pending.phone) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      return fail("Please start registration again and enter a mobile number.", 400);
    }

    if (pending.attempts >= 5) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      return fail("Verification attempt limit exceeded. Request a new code.", 400);
    }

    const submittedHash = hashRegistrationOtp(input.email, input.otp);
    if (!hashesMatch(pending.otpHash, submittedHash)) {
      const updated = await PendingRegistration.findOneAndUpdate(
        { _id: pending._id, attempts: { $lt: 5 }, expiresAt: { $gt: new Date() } },
        { $inc: { attempts: 1 } },
        { returnDocument: "after" },
      );
      if (updated?.attempts >= 5) {
        await PendingRegistration.deleteOne({ _id: updated._id, attempts: { $gte: 5 } });
      }
      return fail("Verification code is invalid or expired.", 400);
    }

    if (await User.exists({ phone: pending.phone })) {
      return fail("Phone number is already registered. Request a new code with another number.", 409);
    }

    const registration = await PendingRegistration.findOneAndDelete({
      _id: pending._id,
      email: input.email,
      otpHash: pending.otpHash,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    });
    if (!registration) {
      return fail("Verification code is invalid or expired. Request a new code.", 400);
    }

    if (await User.exists({ email: registration.email })) {
      return fail("Email is already registered", 409);
    }

    const isFirstAdmin = !(await User.exists({ role: "admin" }));
    const settings = await getSettings();
    const referralSystemEnabled = settings.referrals.enabled !== false;
    const requestedReferralCode = referralSystemEnabled ? registration.referralCode : undefined;
    const referrer = requestedReferralCode
      ? await User.findOne({ referralCode: requestedReferralCode })
      : null;
    const referralCode = await createUniqueReferralCode(User);
    const user = await User.create({
      name: registration.name,
      email: registration.email,
      phone: registration.phone,
      passwordHash: registration.passwordHash,
      role: isFirstAdmin ? "admin" : "user",
      referralCode,
      referredBy: referrer?._id,
    });

    if (referralSystemEnabled && referrer) {
      await Referral.create({ referrer: referrer._id, referredUser: user._id });
    }

    let welcomeEmailSent = true;
    let welcomeEmailMessage: string | undefined;
    try {
      await sendWelcomeEmail(user, request.nextUrl.origin);
    } catch (error) {
      welcomeEmailSent = false;
      welcomeEmailMessage = welcomeEmailFailureMessage(error);
      console.error("Welcome email failed after registration", {
        userId: String(user._id),
        email: user.email,
        error: error instanceof Error ? error.message : "Unknown email delivery error",
      });
    }

    const sessionId = await recordLoginSession(String(user._id), request);
    await setSessionCookie({
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      sessionId,
    });
    try {
      await notifyTelegram("New User Registration", [user.email, `Role: ${user.role}`]);
    } catch (error) {
      console.error("Registration Telegram notification failed", {
        userId: String(user._id),
        error: error instanceof Error ? error.message : "Unknown notification error",
      });
    }

    return ok({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      referralCode: user.referralCode,
      welcomeEmailSent,
      message: welcomeEmailMessage,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      if (
        "keyPattern" in error &&
        error.keyPattern &&
        typeof error.keyPattern === "object" &&
        "phone" in error.keyPattern
      ) {
        return fail("Phone number is already registered", 409);
      }
      return fail("Email is already registered", 409);
    }
    return fail(error instanceof Error ? error.message : "Registration verification failed");
  }
}
