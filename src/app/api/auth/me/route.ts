import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { currentUser, setSessionCookie } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { normalizeRole } from "@/lib/roles";
import { User } from "@/models";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);

  await dbConnect();
  const dbUser = await User.findById(user.id);
  if (!dbUser || dbUser.isBanned) return fail("Unauthorized", 401);
  const role = normalizeRole(dbUser.role);

  if (role !== user.role || dbUser.email !== user.email || dbUser.name !== user.name) {
    await setSessionCookie({ id: user.id, email: dbUser.email, name: dbUser.name, role });
  }

  return ok({
    id: user.id,
    name: dbUser.name,
    email: dbUser.email,
    phone: dbUser.phone ?? "",
    role,
    referralCode: dbUser.referralCode ?? "",
    referralEarnings: dbUser.referralEarnings ?? 0,
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    const { auth, dbUser } = await requireUser();

    dbUser.name = input.name;
    await dbUser.save();

    await setSessionCookie({
      id: auth.id,
      email: dbUser.email,
      name: dbUser.name,
      role: auth.role,
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
