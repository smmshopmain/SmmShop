import { NextRequest } from "next/server";
import { z } from "zod";
import { parseBody, fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { User, Referral } from "@/models";
import { notifyTelegram } from "@/lib/telegram";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.email(),
  password: z.string().min(8),
  referralCode: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    await dbConnect();

    const exists = await User.exists({ email: input.email.toLowerCase() });
    if (exists) return fail("Email is already registered", 409);

    const isFirstAdmin = !(await User.exists({ role: "admin" }));
    const referrer = input.referralCode
      ? await User.findOne({ referralCode: input.referralCode.toUpperCase() })
      : null;
    const referralCode = Math.random().toString(36).slice(2, 10).toUpperCase();
    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: isFirstAdmin ? "admin" : "user",
      referralCode,
      referredBy: referrer?._id,
    });

    if (referrer) {
      await Referral.create({ referrer: referrer._id, referredUser: user._id });
    }

    await setSessionCookie({
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
    });
    await notifyTelegram("New User Registration", [user.email, `Role: ${user.role}`]);

    return ok({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Registration failed");
  }
}
