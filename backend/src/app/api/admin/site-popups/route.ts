import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { AuditLog, Setting, SitePopup, UploadedFile } from "@/models";

const DEFAULT_SLIDESHOW_DURATION_SECONDS = 10;
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
  calendarEventKey: z.string().trim().max(280)
    .regex(/^(?:(?:google|admin):[A-Za-z\d._-]{1,240}:\d{4}-\d{2}-\d{2})?$/)
    .default(""),
  autoCloseAfterSeconds: z.number().int().min(0).max(3600)
    .refine((seconds) => seconds === 0 || seconds >= 3, "Custom display time must be 0 or between 3 and 3600 seconds.")
    .default(0),
  slideshowGroupId: z.union([z.string().regex(/^[a-f\d]{24}$/i), z.literal("")]).default(""),
  showOnEveryRefresh: z.boolean().default(false),
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
const popupStatusSchema = z.object({
  id: idSchema,
  active: z.boolean(),
}).strict();
const popupSlideshowSchema = z.object({
  slideshowDurationSeconds: z.number().int().min(3).max(3600),
}).strict();

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

async function resolveSlideshowGroupId(groupId: string, currentPopupId = "") {
  if (!groupId) return "";
  const groupCampaign = await SitePopup.findById(groupId).select("_id slideshowGroupId").lean();
  if (!groupCampaign) throw new Error("Choose an existing campaign to merge with.");
  const rootId = String(groupCampaign.slideshowGroupId || groupCampaign._id);
  if (rootId === currentPopupId) throw new Error("A campaign cannot be merged with itself.");
  return rootId;
}

export async function GET() {
  try {
    await requireAdmin();
    await dbConnect();
    const [popups, slideshowSetting] = await Promise.all([
      SitePopup.find().sort({ createdAt: -1 }).limit(100).lean(),
      Setting.findOne({ key: "popupSlideshow" }).lean(),
    ]);
    const storedDuration = (slideshowSetting?.value as { durationSeconds?: unknown } | undefined)?.durationSeconds;
    const slideshowDurationSeconds = typeof storedDuration === "number"
      && Number.isInteger(storedDuration)
      && storedDuration >= 3
      && storedDuration <= 3600
      ? storedDuration
      : DEFAULT_SLIDESHOW_DURATION_SECONDS;
    return ok({ popups, slideshowDurationSeconds });
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
    const slideshowGroupId = await resolveSlideshowGroupId(input.slideshowGroupId);
    const popup = await SitePopup.create({
      ...input,
      slideshowGroupId,
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
    if (body && typeof body === "object" && "slideshowDurationSeconds" in body) {
      const slideshowUpdate = popupSlideshowSchema.parse(body);
      const before = await Setting.findOne({ key: "popupSlideshow" }).lean();
      const setting = await Setting.findOneAndUpdate(
        { key: "popupSlideshow" },
        { value: { durationSeconds: slideshowUpdate.slideshowDurationSeconds } },
        { upsert: true, new: true },
      );
      await AuditLog.create({
        actor: auth.id,
        action: "site_popup.slideshow_settings_update",
        entity: "Setting",
        entityId: "popupSlideshow",
        before,
        after: setting,
      });
      return ok({ slideshowDurationSeconds: slideshowUpdate.slideshowDurationSeconds });
    }
    const id = idSchema.parse(body.id);
    const before = await SitePopup.findById(id).lean();
    if (!before) return fail("Popup not found", 404);
    const statusUpdate = popupStatusSchema.safeParse(body);
    if (statusUpdate.success) {
      const popup = await SitePopup.findByIdAndUpdate(
        id,
        { active: statusUpdate.data.active },
        { new: true, runValidators: true },
      );
      if (!popup) return fail("Popup not found", 404);
      await AuditLog.create({
        actor: auth.id,
        action: "site_popup.update",
        entity: "SitePopup",
        entityId: id,
        before,
        after: popup,
      });
      return ok({ popup });
    }

    const input = popupFieldsSchema.partial().parse(body);
    const updated = popupSchema.parse({
      ...before,
      ...input,
      slideshowGroupId: await resolveSlideshowGroupId(
        input.slideshowGroupId ?? before.slideshowGroupId ?? "",
        id,
      ),
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
    if (!before.slideshowGroupId) {
      await SitePopup.updateMany({ slideshowGroupId: id }, { slideshowGroupId: "" });
    }
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
