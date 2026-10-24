import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { currentUser, isEnvironmentAdmin, setSessionCookie } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { createUniqueReferralCode } from "@/lib/referral-code";
import { normalizeRole } from "@/lib/roles";
import { User } from "@/models";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  if (isEnvironmentAdmin(user)) {
    return ok({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: "",
      requiresPhone: false,
      role: user.role,
      referralCode: "",
      referralEarnings: 0,
      walletBalance: 0,
      createdAt: null,
      lastLoginAt: null,
    });
  }

  await dbConnect();
  const dbUser = await User.findById(user.id);
  if (!dbUser || dbUser.isBanned) return fail("Unauthorized", 401);
  const role = normalizeRole(dbUser.role);

  if (!dbUser.referralCode) {
    dbUser.referralCode = await createUniqueReferralCode(User);
    await dbUser.save();
  }

  if (role !== user.role || dbUser.email !== user.email || dbUser.name !== user.name) {
    await setSessionCookie({
      id: user.id,
      email: dbUser.email,
      name: dbUser.name,
      role,
      ...(user.authSource === "database" ? { authSource: "database" as const } : {}),
    });
  }

  return ok({
    id: user.id,
    name: dbUser.name,
    email: dbUser.email,
    phone: dbUser.phone ?? "",
    requiresPhone: Boolean(dbUser.googleSub && !dbUser.phone),
    role,
    referralCode: dbUser.referralCode ?? "",
    referralEarnings: dbUser.referralEarnings ?? 0,
    walletBalance: dbUser.walletBalance ?? 0,
    createdAt: dbUser.createdAt ?? null,
    lastLoginAt: dbUser.lastLoginAt ?? null,
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await currentUser();
    if (user && isEnvironmentAdmin(user)) {
      return fail("Update environment-managed admin details through backend environment variables.", 403);
    }

    const input = await parseBody(request, schema);
    const { auth, dbUser } = await requireUser();

    dbUser.name = input.name;
    await dbUser.save();

    await setSessionCookie({
      id: auth.id,
      email: dbUser.email,
      name: dbUser.name,
      role: auth.role,
      ...(auth.authSource === "database" ? { authSource: "database" as const } : {}),
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
    return fail(error instanceof Error ? error.message : "Unable to update profile");
  }
}
