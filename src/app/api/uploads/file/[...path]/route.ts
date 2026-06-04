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
