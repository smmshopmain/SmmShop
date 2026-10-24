import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { User } from "@/models";

const schema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter a valid phone number with country code."),
});

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    const { dbUser } = await requireUser({ allowMissingGooglePhone: true });

    if (!dbUser.googleSub) {
      return fail("This mobile number step is only required for Google sign-in accounts.", 403);
    }
    if (dbUser.phone) {
      return fail("A mobile number is already saved on this account.", 409);
    }

    const existing = await User.findOne({
      phone: input.phone,
      _id: { $ne: dbUser._id },
    });
    if (existing) return fail("This mobile number is already registered.", 409);

    dbUser.phone = input.phone;
    await dbUser.save();
    return ok({ phone: dbUser.phone, requiresPhone: false });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return fail("This mobile number is already registered.", 409);
    }
    return fail(error instanceof Error ? error.message : "Unable to save your mobile number.");
  }
}
