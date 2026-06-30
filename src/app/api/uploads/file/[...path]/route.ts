import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { UploadedFile } from "@/models";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

function bufferFromUploadData(data: unknown) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (data && typeof data === "object" && "buffer" in data) {
    const nested = (data as { buffer?: unknown }).buffer;
    if (Buffer.isBuffer(nested)) return nested;
    if (nested instanceof Uint8Array) return Buffer.from(nested);
    if (nested instanceof ArrayBuffer) return Buffer.from(nested);
  }
  return null;
}

async function readStoredUpload(folder: string, fileName: string) {
  await dbConnect();
  const upload = await UploadedFile.findOne({ folder, fileName }).lean();
  if (!upload) return null;
  const data = bufferFromUploadData((upload as { data?: unknown }).data);
  if (!data) return null;
  return {
    data,
    contentType: String((upload as { contentType?: unknown }).contentType || contentTypes[path.extname(fileName).toLowerCase()]),
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: segments } = await context.params;
    if (!segments || segments.length !== 2) return fail("Invalid upload path", 404);
    const [folder, fileName] = segments;
    if (!["deposit-proofs", "payment-qr"].includes(folder)) return fail("Invalid upload folder", 404);

    const uploadsRoot = path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsRoot, folder, path.basename(fileName));
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(uploadsRoot))) return fail("Invalid upload path", 404);

    const ext = path.extname(fileName).toLowerCase();
    const contentType = contentTypes[ext];
    if (!contentType) return fail("Unsupported file type", 404);

    const storedUpload = await readStoredUpload(folder, path.basename(fileName));
    if (storedUpload) {
      return new NextResponse(new Uint8Array(storedUpload.data), {
        headers: {
          "content-type": storedUpload.contentType,
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    const file = await readFile(resolvedPath);
    return new NextResponse(file, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return fail("Upload not found", 404);
  }
}
