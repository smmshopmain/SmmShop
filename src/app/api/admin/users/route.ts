import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { AuditLog, User } from "@/models";
import { hashPassword } from "@/lib/auth";

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const q = new URL(request.url).searchParams.get("q");
    const filter = q
      ? { $or: [{ email: new RegExp(q, "i") }, { name: new RegExp(q, "i") }] }
      : {};
    const users = await User.find(filter)
      .select("-passwordHash -passwordResetTokenHash -passwordResetAttempts")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return ok({ users });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load users", 403);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    const body = await request.json();
    const id = z.string().parse(body.id);
    const action = z.enum(["ban", "unban", "freeze_wallet", "unfreeze_wallet", "reset_password"]).parse(body.action);
    const before = await User.findById(id).lean();
    const update: Record<string, unknown> = {};
    if (action === "ban") update.isBanned = true;
    if (action === "unban") update.isBanned = false;
    if (action === "freeze_wallet") update.walletFrozen = true;
    if (action === "unfreeze_wallet") update.walletFrozen = false;
    if (action === "reset_password") update.passwordHash = await hashPassword(z.string().min(8).parse(body.password));
    const user = await User.findByIdAndUpdate(id, update, { new: true }).select("-passwordHash");
    await AuditLog.create({ actor: auth.id, action: `user.${action}`, entity: "User", entityId: id, before, after: user });
    return ok({ user });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update user");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    const body = deleteSchema.parse(await request.json().catch(() => null));
    if (body.id === auth.id) return fail("You cannot delete your own active admin account.");

    const user = await User.findById(body.id).lean();
    if (!user) return fail("User not found", 404);

    await User.deleteOne({ _id: body.id });
    await AuditLog.create({
      actor: auth.id,
      action: "user.delete",
      entity: "User",
      entityId: body.id,
      before: user,
    });

    return ok({ deleted: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to delete user");
  }
}
