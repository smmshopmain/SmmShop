import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { currentUser, setSessionCookie } from "@/lib/auth";
import { User } from "@/models";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(25).optional(),
});

export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  return ok(user);
}

export async function PATCH(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    const { auth, dbUser } = await requireUser();
    const phone = input.phone || undefined;

    if (phone) {
      const existing = await User.findOne({ phone, _id: { $ne: dbUser._id } });
      if (existing) return fail("Phone number is already in use", 409);
    }

    dbUser.name = input.name;
    dbUser.phone = phone;
    await dbUser.save();

    await setSessionCookie({
      id: auth.id,
      email: auth.email,
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
