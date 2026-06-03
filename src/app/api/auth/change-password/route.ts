import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    const { dbUser } = await requireUser();
    if (!(await verifyPassword(input.currentPassword, dbUser.passwordHash))) {
      return fail("Current password is incorrect", 400);
    }
    dbUser.passwordHash = await hashPassword(input.newPassword);
    await dbUser.save();
    return ok({ changed: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to change password", 401);
  }
}
