import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { authenticateEnvironmentAdmin, setSessionCookie, verifyPassword } from "@/lib/auth";
import { User } from "@/models";
import { rateLimit } from "@/lib/rate-limit";
import { recordLoginSession } from "@/lib/login-session";

const schema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!(await rateLimit(`login:${ip}`, 10))) return fail("Too many login attempts", 429);

  try {
    const input = await parseBody(request, schema);
    const environmentAdmin = authenticateEnvironmentAdmin(input.email, input.password);
    if (environmentAdmin) {
      await setSessionCookie(environmentAdmin);
      return ok({
        id: environmentAdmin.id,
        name: environmentAdmin.name,
        email: environmentAdmin.email,
        role: environmentAdmin.role,
      });
    }

    await dbConnect();
    const identifier = input.email.toLowerCase();
    const user = await User.findOne(
      identifier.includes("@")
        ? { email: identifier }
        : { phone: identifier.replace(/\D/g, "") },
    );
    if (!user || user.role === "admin" || !(await verifyPassword(input.password, user.passwordHash))) {
      return fail("Invalid email or password", 401);
    }
    if (user.isBanned) return fail("Your account is banned", 403);

    const sessionId = await recordLoginSession(String(user._id), request);
    await setSessionCookie({
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      sessionId,
    });

    return ok({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Login failed");
  }
}
