import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/api";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

const allowedFolders = new Set(["deposit-proofs", "payment-qr"]);

async function readUploadFile(segments: string[]) {
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

    const file = await readUploadFile(segments);
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
