import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { hashPhoneChangeOtp } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";
import { AuditLog, User } from "@/models";

const schema = z.object({
  phone: z.string().trim().min(6).max(25),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6 digit OTP"),
});

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    const { auth, dbUser } = await requireUser();
    const nextPhone = input.phone;

    if (!(await rateLimit(`phone-change-verify:${auth.id}`, 10))) {
      return fail("Too many phone change attempts", 429);
    }

    if (
      !dbUser.phoneChangeNewPhone ||
      dbUser.phoneChangeNewPhone !== nextPhone ||
      !dbUser.phoneChangeTokenHash ||
      !dbUser.phoneChangeExpiresAt ||
      dbUser.phoneChangeExpiresAt.getTime() < Date.now()
    ) {
      return fail("OTP is invalid or expired", 400);
    }

    if ((dbUser.phoneChangeAttempts ?? 0) >= 5) {
      dbUser.phoneChangeNewPhone = undefined;
      dbUser.phoneChangeTokenHash = undefined;
      dbUser.phoneChangeExpiresAt = undefined;
      dbUser.phoneChangeAttempts = 0;
      await dbUser.save();
      return fail("OTP attempt limit exceeded. Request a new OTP.", 400);
    }

    const otpHash = hashPhoneChangeOtp(auth.id, nextPhone, input.otp);
    if (otpHash !== dbUser.phoneChangeTokenHash) {
      dbUser.phoneChangeAttempts = (dbUser.phoneChangeAttempts ?? 0) + 1;
      await dbUser.save();
      return fail("OTP is invalid or expired", 400);
    }

    const existing = await User.findOne({ phone: nextPhone, _id: { $ne: dbUser._id } });
    if (existing) return fail("Phone number is already in use", 409);

    const previousPhone = dbUser.phone ?? "";
    dbUser.phone = nextPhone;
    dbUser.phoneChangeNewPhone = undefined;
    dbUser.phoneChangeTokenHash = undefined;
    dbUser.phoneChangeExpiresAt = undefined;
    dbUser.phoneChangeAttempts = 0;
    await dbUser.save();

    await AuditLog.create({
      actor: auth.id,
      action: "user.phone_change",
      entity: "User",
      entityId: auth.id,
      before: { phone: previousPhone },
      after: { phone: dbUser.phone ?? "" },
    });

    return ok({
      user: {
        id: auth.id,
        name: dbUser.name,
        email: dbUser.email,
        phone: dbUser.phone ?? "",
        role: auth.role,
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to change phone");
  }
}
