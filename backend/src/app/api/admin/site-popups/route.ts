import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { AuditLog, SitePopup } from "@/models";

const popupSchema = z.object({
  title: z.string().trim().min(2).max(120),
  kind: z.enum(["announcement", "advertisement"]),
  message: z.string().trim().min(2).max(2000),
  emoji: z.string().trim().max(16).default("✨"),
  linkHref: z.string().trim().max(2048).default(""),
  linkLabel: z.string().trim().max(60).default(""),
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  active: z.boolean().default(true),
}).superRefine((popup, context) => {
  if (new Date(popup.expiresAt).getTime() <= new Date(popup.startsAt).getTime()) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Expiry must be after the start time." });
  }
  if (popup.linkHref) {
    try {
      const url = new URL(popup.linkHref, "https://internal.invalid");
      if (
        !popup.linkHref.startsWith("/")
        || popup.linkHref.startsWith("//")
        || popup.linkHref.includes("\\")
        || url.origin !== "https://internal.invalid"
        || url.pathname === "/api"
        || url.pathname.startsWith("/api/")
      ) {
        throw new Error("Not an internal page");
      }
    } catch {
      context.addIssue({
        code: "custom",
        path: ["linkHref"],
        message: "Choose an internal website page or service link.",
      });
    }
  }
  if (!popup.linkHref && popup.linkLabel) {
    context.addIssue({ code: "custom", path: ["linkLabel"], message: "Add a link before setting its button label." });
  }
});

const idSchema = z.string().regex(/^[a-f\d]{24}$/i);

export async function GET() {
  try {
    await requireAdmin();
    await dbConnect();
    const popups = await SitePopup.find().sort({ createdAt: -1 }).limit(100).lean();
    return ok({ popups });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load popups", 403);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const input = popupSchema.parse(await request.json());
    const popup = await SitePopup.create({
      ...input,
      startsAt: new Date(input.startsAt),
      expiresAt: new Date(input.expiresAt),
      createdBy: auth.id,
    });
    await AuditLog.create({
      actor: auth.id,
      action: "site_popup.create",
      entity: "SitePopup",
      entityId: String(popup._id),
      after: popup,
    });
    return ok({ popup });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create popup");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const body = await request.json();
    const id = idSchema.parse(body.id);
    const input = popupSchema.partial().parse(body);
    const before = await SitePopup.findById(id).lean();
    if (!before) return fail("Popup not found", 404);
    const updated = popupSchema.parse({
      ...before,
      ...input,
      startsAt: input.startsAt ?? new Date(before.startsAt).toISOString(),
      expiresAt: input.expiresAt ?? new Date(before.expiresAt).toISOString(),
    });
    const popup = await SitePopup.findByIdAndUpdate(
      id,
      { ...updated, startsAt: new Date(updated.startsAt), expiresAt: new Date(updated.expiresAt) },
      { new: true, runValidators: true },
    );
    await AuditLog.create({
      actor: auth.id,
      action: "site_popup.update",
      entity: "SitePopup",
      entityId: id,
      before,
      after: popup,
    });
    return ok({ popup });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update popup");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const body = await request.json();
    const id = idSchema.parse(body.id);
    const before = await SitePopup.findById(id).lean();
    if (!before) return fail("Popup not found", 404);
    await SitePopup.deleteOne({ _id: id });
    await AuditLog.create({
      actor: auth.id,
      action: "site_popup.delete",
      entity: "SitePopup",
      entityId: id,
      before,
    });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to delete popup");
  }
}
