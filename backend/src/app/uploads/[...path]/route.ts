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

const allowedFolders = new Set(["deposit-proofs", "payment-qr"]);

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

async function readStoredUpload(segments: string[]) {
  const safeSegments = segments.map((segment) => path.basename(segment)).filter(Boolean);
  if (safeSegments.length !== 2 || !allowedFolders.has(safeSegments[0])) return null;

  await dbConnect();
  const [folder, fileName] = safeSegments;
  const upload = await UploadedFile.findOne({ folder, fileName }).lean();
  if (!upload) return null;
  const data = bufferFromUploadData((upload as { data?: unknown }).data);
  if (!data) return null;
  return {
    data,
    contentType: String((upload as { contentType?: unknown }).contentType || contentTypes[path.extname(fileName).toLowerCase()]),
  };
}

async function readLocalUploadFile(segments: string[]) {
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const safeSegments = segments.map((segment) => path.basename(segment)).filter(Boolean);
  if (safeSegments.length === 0 || safeSegments.length > 2) return null;
  if (safeSegments.length === 2 && !allowedFolders.has(safeSegments[0])) return null;

  const filePath = path.resolve(uploadsRoot, ...safeSegments);
  if (!filePath.startsWith(uploadsRoot)) return null;

  return readFile(filePath);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: segments } = await context.params;
    const fileName = segments?.at(-1) ?? "";
    const ext = path.extname(fileName).toLowerCase();
    const contentType = contentTypes[ext];
    if (!contentType) return fail("Unsupported file type", 404);

    const storedUpload = await readStoredUpload(segments);
    if (storedUpload) {
      return new NextResponse(new Uint8Array(storedUpload.data), {
        headers: {
          "content-type": storedUpload.contentType,
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    const file = await readLocalUploadFile(segments);
    if (!file) return fail("Upload not found", 404);

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
