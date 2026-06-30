import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { hashPasswordChangeOtp } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";
import { AuditLog } from "@/models";

const schema = z.object({
  otp: z.string().regex(/^\d{6}$/, "Enter the 6 digit OTP"),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    const { auth, dbUser } = await requireUser();

    if (!(await rateLimit(`password-change-verify:${auth.id}`, 10))) {
      return fail("Too many password change attempts", 429);
    }

    if (
      !dbUser.passwordChangeTokenHash ||
      !dbUser.passwordChangeExpiresAt ||
      dbUser.passwordChangeExpiresAt.getTime() < Date.now()
    ) {
      return fail("OTP is invalid or expired", 400);
    }

    if ((dbUser.passwordChangeAttempts ?? 0) >= 5) {
      dbUser.passwordChangeTokenHash = undefined;
      dbUser.passwordChangeExpiresAt = undefined;
      dbUser.passwordChangeAttempts = 0;
      await dbUser.save();
      return fail("OTP attempt limit exceeded. Request a new OTP.", 400);
    }

    const otpHash = hashPasswordChangeOtp(auth.id, input.otp);
    if (otpHash !== dbUser.passwordChangeTokenHash) {
      dbUser.passwordChangeAttempts = (dbUser.passwordChangeAttempts ?? 0) + 1;
      await dbUser.save();
      return fail("OTP is invalid or expired", 400);
    }

    dbUser.passwordHash = await hashPassword(input.newPassword);
    dbUser.passwordChangeTokenHash = undefined;
    dbUser.passwordChangeExpiresAt = undefined;
    dbUser.passwordChangeAttempts = 0;
    await dbUser.save();

    await AuditLog.create({
      actor: auth.id,
      action: "user.password_change_otp",
      entity: "User",
      entityId: auth.id,
      before: { method: "otp" },
      after: { changed: true },
    });

    return ok({ changed: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to change password");
  }
}
