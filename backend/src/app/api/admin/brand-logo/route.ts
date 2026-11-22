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
    await UploadedFile.create({
      folder: "brand-assets",
      fileName,
      contentType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
      size: file.size,
      createdBy: auth.id,
    });
    return ok({ url: `/api/uploads/file/brand-assets/${fileName}` });
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
