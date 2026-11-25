import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { Setting, UploadedFile } from "@/models";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_BRAND_LOGO_SIZE = 5 * 1024 * 1024;
const logoUrlSchema = z.string().regex(/^\/api\/uploads\/file\/brand-assets\/[a-f\d-]+\.(?:jpg|png|webp)$/i);

function getStoredLogoUrl(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const logoUrl = (value as Record<string, unknown>).brandLogoUrl;
  return typeof logoUrl === "string" && logoUrlSchema.safeParse(logoUrl).success ? logoUrl : "";
}

export async function POST(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("Brand logo is required.");
    if (!allowedTypes.has(file.type)) return fail("Only JPG, PNG, or WEBP brand logos are allowed.");
    if (file.size === 0 || file.size > MAX_BRAND_LOGO_SIZE) {
      return fail("Brand logo must be larger than 0 bytes and 5MB or smaller.");
    }

    const fileName = `${randomUUID()}.${allowedTypes.get(file.type)}`;
    const logoUrl = `/api/uploads/file/brand-assets/${fileName}`;
    const existingSetting = await Setting.findOne({ key: "siteFooter" }).select("value").lean();
    const previousLogoUrl = getStoredLogoUrl(existingSetting?.value);
    await UploadedFile.create({
      folder: "brand-assets",
      fileName,
      contentType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
      size: file.size,
      createdBy: auth.id,
    });

    try {
      await Setting.updateOne(
        { key: "siteFooter" },
        { $set: { "value.brandLogoUrl": logoUrl } },
        { upsert: true },
      );
    } catch (error) {
      try {
        await UploadedFile.deleteOne({ folder: "brand-assets", fileName });
      } catch (cleanupError) {
        console.error("Unable to clean up a logo upload after its settings update failed.", cleanupError);
      }
      throw error;
    }

    let cleanupWarning = false;
    if (previousLogoUrl && previousLogoUrl !== logoUrl) {
      const previousFileName = previousLogoUrl.split("/").at(-1);
      if (previousFileName) {
        try {
          await UploadedFile.deleteOne({ folder: "brand-assets", fileName: previousFileName });
        } catch (error) {
          cleanupWarning = true;
          console.error("Brand logo was updated, but the previous uploaded logo could not be removed.", error);
        }
      }
    }

    return ok({ url: logoUrl, cleanupWarning });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to upload the brand logo.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();
    const { imageUrl } = z.object({ imageUrl: logoUrlSchema }).parse(await request.json());
    const settings = await Setting.findOne({ key: "siteFooter" }).select("value").lean();
    const currentLogoUrl = (settings?.value as { brandLogoUrl?: unknown } | undefined)?.brandLogoUrl;
    if (currentLogoUrl === imageUrl) {
      return fail("Save the brand settings without this logo before removing the uploaded file.");
    }

    const fileName = imageUrl.split("/").at(-1);
    if (!fileName) return fail("Invalid brand logo path.");
    const result = await UploadedFile.deleteOne({ folder: "brand-assets", fileName });
    return ok({ deleted: result.deletedCount > 0 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to remove the brand logo.");
  }
}
