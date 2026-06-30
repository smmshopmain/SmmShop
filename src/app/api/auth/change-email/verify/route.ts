import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { hashEmailChangeOtp } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";
import { setSessionCookie } from "@/lib/auth";
import { AuditLog, User } from "@/models";

const schema = z.object({
  email: z.email(),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6 digit OTP"),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!(await rateLimit(`email-change-verify:${ip}`, 10))) {
    return fail("Too many email change attempts", 429);
  }

  try {
    const input = await parseBody(request, schema);
    const { auth, dbUser } = await requireUser();
    const nextEmail = input.email.toLowerCase();

    if (
      !dbUser.emailChangeNewEmail ||
      dbUser.emailChangeNewEmail !== nextEmail ||
      !dbUser.emailChangeTokenHash ||
      !dbUser.emailChangeExpiresAt ||
      dbUser.emailChangeExpiresAt.getTime() < Date.now()
    ) {
      return fail("OTP is invalid or expired", 400);
    }

    if ((dbUser.emailChangeAttempts ?? 0) >= 5) {
      dbUser.emailChangeNewEmail = undefined;
      dbUser.emailChangeTokenHash = undefined;
      dbUser.emailChangeExpiresAt = undefined;
      dbUser.emailChangeAttempts = 0;
      await dbUser.save();
      return fail("OTP attempt limit exceeded. Request a new OTP.", 400);
    }

    const otpHash = hashEmailChangeOtp(auth.id, nextEmail, input.otp);
    if (otpHash !== dbUser.emailChangeTokenHash) {
      dbUser.emailChangeAttempts = (dbUser.emailChangeAttempts ?? 0) + 1;
      await dbUser.save();
      return fail("OTP is invalid or expired", 400);
    }

    const existing = await User.findOne({ email: nextEmail, _id: { $ne: dbUser._id } });
    if (existing) return fail("Email is already registered", 409);

    const previousEmail = dbUser.email;
    dbUser.email = nextEmail;
    dbUser.emailChangeNewEmail = undefined;
    dbUser.emailChangeTokenHash = undefined;
    dbUser.emailChangeExpiresAt = undefined;
    dbUser.emailChangeAttempts = 0;
    await dbUser.save();

    await setSessionCookie({
      id: auth.id,
      email: dbUser.email,
      name: dbUser.name,
      role: auth.role,
    });

    await AuditLog.create({
      actor: auth.id,
      action: "user.email_change",
      entity: "User",
      entityId: auth.id,
      before: { email: previousEmail },
      after: { email: dbUser.email },
    });

    return ok({
      user: {
        id: auth.id,
        name: dbUser.name,
        email: dbUser.email,
        role: auth.role,
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to change email");
  }
}
