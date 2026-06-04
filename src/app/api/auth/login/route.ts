import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { User } from "@/models";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!(await rateLimit(`login:${ip}`, 10))) return fail("Too many login attempts", 429);

  try {
    const input = await parseBody(request, schema);
    await dbConnect();
    const identifier = input.email.toLowerCase();
    const user = await User.findOne(
      identifier.includes("@")
        ? { email: identifier }
        : { phone: identifier.replace(/\D/g, "") },
    );
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      return fail("Invalid email or password", 401);
    }
    if (user.isBanned) return fail("Your account is banned", 403);

    user.lastLoginAt = new Date();
    await user.save();
    await setSessionCookie({
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return ok({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Login failed");
  }
}
