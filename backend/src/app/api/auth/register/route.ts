import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { buildRegistrationOtpEmail, sendMail } from "@/lib/email";
import { hashPassword } from "@/lib/auth";
import { createPasswordResetOtp, hashRegistrationOtp } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";
import { PendingRegistration, User } from "@/models";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().transform((email) => email.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  referralCode: z.string().trim().max(40).optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await rateLimit(`register-request-ip:${ip}`, 5, 10 * 60_000))) {
    return fail("Too many registration requests. Please try again later.", 429);
  }

  try {
    const input = await parseBody(request, schema);
    if (!(await rateLimit(`register-request-email:${input.email}`, 3, 10 * 60_000))) {
      return fail("Too many verification codes requested. Please try again later.", 429);
    }

    await dbConnect();
    if (await User.exists({ email: input.email })) {
      return fail("Email is already registered", 409);
    }

    const otp = createPasswordResetOtp();
    const otpHash = hashRegistrationOtp(input.email, otp);
    const pending = await PendingRegistration.findOneAndUpdate(
      { email: input.email },
      {
        $set: {
          name: input.name,
          passwordHash: await hashPassword(input.password),
          referralCode: input.referralCode?.trim().toUpperCase() || undefined,
          otpHash,
          expiresAt: new Date(Date.now() + 10 * 60_000),
          attempts: 0,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    try {
      await sendMail({
        to: input.email,
        ...buildRegistrationOtpEmail(otp),
      });
    } catch (error) {
      if (pending) {
        await PendingRegistration.deleteOne({ _id: pending._id, otpHash });
      }
      throw error;
    }

    return ok({ email: input.email, message: "Verification OTP sent. Check your email." });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return fail("Email is already registered", 409);
    }
    return fail(error instanceof Error ? error.message : "Unable to start registration");
  }
}
