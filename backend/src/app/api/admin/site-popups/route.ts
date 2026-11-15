import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { AuditLog, SitePopup, UploadedFile } from "@/models";

const popupFieldsSchema = z.object({
  title: z.string().trim().max(120).default(""),
  kind: z.enum(["announcement", "advertisement"]),
  message: z.string().trim().max(2000).default(""),
  emoji: z.string().trim().max(16).default("✨"),
  imageUrl: z.string().trim().max(500).default(""),
  linkType: z.enum(["none", "internal", "external"]).default("none"),
  linkHref: z.string().trim().max(2048).default(""),
  linkLabel: z.string().trim().max(60).default(""),
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  autoCloseAfterSeconds: z.number().int().min(0).max(3600).default(0),
  active: z.boolean().default(true),
});

const popupSchema = popupFieldsSchema.superRefine((popup, context) => {
  if (!popup.imageUrl) {
    if (popup.title.length < 2) {
      context.addIssue({ code: "custom", path: ["title"], message: "Add a heading or upload a popup image." });
    }
    if (popup.message.length < 2) {
      context.addIssue({ code: "custom", path: ["message"], message: "Add a message or upload a popup image." });
    }
  }
  if (new Date(popup.expiresAt).getTime() <= new Date(popup.startsAt).getTime()) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Expiry must be after the start time." });
  }
  if (popup.imageUrl && !/^\/api\/uploads\/file\/popup-images\/[a-f\d-]+\.(?:jpg|png|webp)$/i.test(popup.imageUrl)) {
    context.addIssue({ code: "custom", path: ["imageUrl"], message: "Choose a valid uploaded popup image." });
  }
  if (popup.linkType === "none" && popup.linkHref) {
    context.addIssue({ code: "custom", path: ["linkHref"], message: "Choose an internal or external destination for this link." });
  }
  if (popup.linkType !== "none" && !popup.linkHref) {
    context.addIssue({ code: "custom", path: ["linkHref"], message: "Enter the destination URL or choose no link." });
  }
  if (popup.linkType === "internal" && popup.linkHref) {
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
  if (popup.linkType === "external" && popup.linkHref) {
    try {
      const url = new URL(popup.linkHref);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("Not a safe external link");
      }
    } catch {
      context.addIssue({
        code: "custom",
        path: ["linkHref"],
        message: "Enter a valid external http:// or https:// URL.",
      });
    }
  }
  if (!popup.linkHref && popup.linkLabel) {
    context.addIssue({ code: "custom", path: ["linkLabel"], message: "Add a link before setting its button label." });
  }
});

const idSchema = z.string().regex(/^[a-f\d]{24}$/i);

async function removeUnusedImage(imageUrl: string) {
  const fileName = /^\/api\/uploads\/file\/popup-images\/([a-f\d-]+\.(?:jpg|png|webp))$/i.exec(imageUrl)?.[1];
  if (!fileName || await SitePopup.exists({ imageUrl })) return;
  await UploadedFile.deleteOne({ folder: "popup-images", fileName });
}

async function validatePopupImage(imageUrl: string) {
  if (!imageUrl) return;
  const fileName = imageUrl.split("/").at(-1);
  if (!fileName || !await UploadedFile.exists({ folder: "popup-images", fileName })) {
    throw new Error("Popup image upload was not found. Upload the image again.");
  }
}

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
    await validatePopupImage(input.imageUrl);
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
    const input = popupFieldsSchema.partial().parse(body);
    const before = await SitePopup.findById(id).lean();
    if (!before) return fail("Popup not found", 404);
    const updated = popupSchema.parse({
      ...before,
      ...input,
      startsAt: input.startsAt ?? new Date(before.startsAt).toISOString(),
      expiresAt: input.expiresAt ?? new Date(before.expiresAt).toISOString(),
    });
    await validatePopupImage(updated.imageUrl);
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
    if (before.imageUrl && before.imageUrl !== popup?.imageUrl) await removeUnusedImage(before.imageUrl);
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
    if (before.imageUrl) await removeUnusedImage(before.imageUrl);
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
