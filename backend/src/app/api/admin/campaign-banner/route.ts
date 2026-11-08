import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { UploadedFile } from "@/models";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("Banner image is required.");
    if (!allowedTypes.has(file.type)) return fail("Only JPG, PNG, or WEBP banner images are allowed.");
    if (file.size > 2 * 1024 * 1024) return fail("Banner image must be 2MB or smaller.");

    const fileName = `${randomUUID()}.${allowedTypes.get(file.type)}`;
    const data = Buffer.from(await file.arrayBuffer());
    await UploadedFile.create({
      folder: "campaign-banners",
      fileName,
      contentType: file.type,
      data,
      size: file.size,
      createdBy: auth.id,
    });

    return ok({ url: `/api/uploads/file/campaign-banners/${fileName}` });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to upload campaign banner.");
  }
}
