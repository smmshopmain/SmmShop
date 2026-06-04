import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("QR image is required");
    if (!allowedTypes.has(file.type)) return fail("Only JPG, PNG, or WEBP QR images are allowed");
    if (file.size > 2 * 1024 * 1024) return fail("QR image must be 2MB or smaller");

    const ext = allowedTypes.get(file.type);
    const fileName = `${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "payment-qr");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()));

    return ok({ url: `/uploads/payment-qr/${fileName}` });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to upload QR image");
  }
}
