import { NextRequest } from "next/server";
import { fail, ok, requireUser } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { sendWelcomeEmail } from "@/lib/welcome-email";

export async function POST(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof requireUser>>["auth"];
  let dbUser: Awaited<ReturnType<typeof requireUser>>["dbUser"];
  try {
    ({ auth, dbUser } = await requireUser());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  if (!(await rateLimit(`welcome-email:${auth.id}`, 3, 24 * 60 * 60_000))) {
    return fail("Too many welcome email requests. Please try again tomorrow.", 429);
  }

  try {
    await sendWelcomeEmail(dbUser, request.nextUrl.origin);
    return ok({ message: "Welcome email sent. Check your inbox and spam folder." });
  } catch (error) {
    console.error("Welcome email retry failed", {
      error: error instanceof Error ? error.message : "Unknown email delivery error",
    });
    return fail("Welcome email could not be sent. Please try again later or contact support.", 502);
  }
}
