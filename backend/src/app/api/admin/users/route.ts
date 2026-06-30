import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { AuditLog, User } from "@/models";
import { hashPassword } from "@/lib/auth";
import { ASSIGNABLE_USER_ROLES, isMainAdmin } from "@/lib/roles";

const deleteSchema = z.object({
  id: z.string().min(1),
});
const assignableRoleSchema = z.enum(ASSIGNABLE_USER_ROLES);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function canMutateUser(actorRole: string, targetRole: string, action: string) {
  if (action === "set_role") return isMainAdmin(actorRole);
  if (action === "delete") return isMainAdmin(actorRole);
  if (isMainAdmin(targetRole) && !isMainAdmin(actorRole)) return false;
  if (targetRole === "secondary_admin" && !isMainAdmin(actorRole)) return false;
  return actorRole === "admin" || actorRole === "secondary_admin";
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const q = new URL(request.url).searchParams.get("q");
    const pattern = q ? new RegExp(escapeRegExp(q), "i") : null;
    const filter = q
      ? { $or: [{ email: pattern }, { name: pattern }, { phone: pattern }] }
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
    const action = z.enum(["ban", "unban", "freeze_wallet", "unfreeze_wallet", "reset_password", "set_role"]).parse(body.action);
    const before = await User.findById(id).lean();
    if (!before) return fail("User not found", 404);
    if (id === auth.id && action !== "reset_password") return fail("Use profile settings for your own account.", 403);
    if (!canMutateUser(auth.role, String(before.role), action)) return fail("Only the main admin can perform this action.", 403);

    const update: Record<string, unknown> = {};
    if (action === "ban") update.isBanned = true;
    if (action === "unban") update.isBanned = false;
    if (action === "freeze_wallet") update.walletFrozen = true;
    if (action === "unfreeze_wallet") update.walletFrozen = false;
    if (action === "reset_password") update.passwordHash = await hashPassword(z.string().min(8).parse(body.password));
    if (action === "set_role") update.role = assignableRoleSchema.parse(body.role);

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
    if (!canMutateUser(auth.role, String(user.role), "delete")) return fail("Only the main admin can delete users.", 403);

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
