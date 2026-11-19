import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { SitePopup, UploadedFile } from "@/models";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_POPUP_IMAGE_SIZE = 10 * 1024 * 1024;
const imageUrlSchema = z.string().regex(/^\/api\/uploads\/file\/popup-images\/[a-f\d-]+\.(?:jpg|png|webp)$/i);

export async function POST(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("Popup image is required.");
    if (!allowedTypes.has(file.type)) return fail("Only JPG, PNG, or WEBP popup images are allowed.");
    if (file.size === 0 || file.size > MAX_POPUP_IMAGE_SIZE) {
      return fail("Popup image must be larger than 0 bytes and 10MB or smaller.");
    }

    const fileName = `${randomUUID()}.${allowedTypes.get(file.type)}`;
    await UploadedFile.create({
      folder: "popup-images",
      fileName,
      contentType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
      size: file.size,
      createdBy: auth.id,
    });
    return ok({ url: `/api/uploads/file/popup-images/${fileName}` });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to upload popup image.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();
    const { imageUrl } = z.object({ imageUrl: imageUrlSchema }).parse(await request.json());
    const fileName = imageUrl.split("/").at(-1);
    if (!fileName) return fail("Invalid popup image path.");
    const inUse = await SitePopup.exists({
      $or: [{ imageUrl }, { mobileImageUrl: imageUrl }, { desktopImageUrl: imageUrl }],
    });
    if (inUse) return ok({ deleted: false, inUse: true });

    const result = await UploadedFile.deleteOne({ folder: "popup-images", fileName });
    return ok({ deleted: result.deletedCount > 0 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to remove popup image.");
  }
}
