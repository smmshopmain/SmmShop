import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { fail, ok, requireUser } from "@/lib/api";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("Proof file is required");
    if (!allowedTypes.has(file.type)) return fail("Only JPG, PNG, WEBP, or PDF files are allowed");
    if (file.size > 5 * 1024 * 1024) return fail("Proof file must be 5MB or smaller");

    const ext = allowedTypes.get(file.type);
    const fileName = `${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "uploads", "deposit-proofs");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()));

    return ok({ url: `/api/uploads/file/deposit-proofs/${fileName}` });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to upload proof");
  }
}
