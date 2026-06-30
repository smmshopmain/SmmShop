import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { fail, ok, requireUser } from "@/lib/api";
import { UploadedFile } from "@/models";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

export async function POST(request: NextRequest) {
  try {
    const { auth } = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("Proof file is required");
    if (!allowedTypes.has(file.type)) return fail("Only JPG, PNG, WEBP, or PDF files are allowed");
    if (file.size > 5 * 1024 * 1024) return fail("Proof file must be 5MB or smaller");

    const ext = allowedTypes.get(file.type);
    const fileName = `${randomUUID()}.${ext}`;
    const data = Buffer.from(await file.arrayBuffer());
    await UploadedFile.create({
      folder: "deposit-proofs",
      fileName,
      contentType: file.type,
      data,
      size: file.size,
      createdBy: auth.id,
    });

    return ok({ url: `/api/uploads/file/deposit-proofs/${fileName}` });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to upload proof");
  }
}
