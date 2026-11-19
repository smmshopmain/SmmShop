import { randomUUID } from "node:crypto";
import { UploadedFile } from "@/models";

const VELONA_IMAGE_RENDER_URL = "https://velona.in/gateway/v1/images/render";
const VELONA_IMAGE_MODEL = "openai/gpt-5-image-mini";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const allowedFolders = ["campaign-banners", "popup-images"] as const;
type ImageFolder = (typeof allowedFolders)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function providerErrorCode(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error)) return "";
  return typeof payload.error.code === "string" ? payload.error.code.toUpperCase() : "";
}

function imageFormat(data: Buffer) {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { extension: "png", contentType: "image/png" };
  }
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { extension: "webp", contentType: "image/webp" };
  }
  throw new Error("Velona returned an unsupported image format.");
}

function embeddedImageData(image: Record<string, unknown>) {
  if (typeof image.b64_json === "string") return image.b64_json;
  if (typeof image.url === "string") {
    const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z\d+/=]+)$/i.exec(image.url);
    if (match) return match[1];
  }
  throw new Error("Velona did not return downloadable image data.");
}

export async function generateVelonaCampaignImage(
  input: { prompt: string; folder: ImageFolder; createdBy: string },
) {
  const apiKey = process.env.VELONA_API_KEY?.trim();
  if (!apiKey) throw new Error("Set VELONA_API_KEY in the backend environment before generating images.");
  if (!allowedFolders.includes(input.folder)) throw new Error("Unsupported campaign image destination.");
  if (!input.prompt.trim() || input.prompt.length > 4000) {
    throw new Error("Campaign image prompt must be between 1 and 4,000 characters.");
  }

  const response = await fetch(VELONA_IMAGE_RENDER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(80_000),
    body: JSON.stringify({
      model: VELONA_IMAGE_MODEL,
      prompt: input.prompt,
      config: { size: "1024x1024", quality: "high", count: 1 },
    }),
  });

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      console.error("Velona image generation returned a non-JSON error.", { status: response.status });
      throw new Error(`Velona image generation failed (${response.status}).`);
    }
    const code = providerErrorCode(payload);
    console.error("Velona image generation failed.", { status: response.status, code: code || "UNKNOWN" });
    if (response.status === 401 || code === "INVALID_KEY") {
      throw new Error("Velona rejected the API key. Check VELONA_API_KEY in the backend environment.");
    }
    if (response.status === 402 || code === "INSUFFICIENT_CREDITS") {
      throw new Error("Velona image-generation credits are insufficient. Add credits and try again.");
    }
    if (response.status === 429 || code === "RATE_LIMIT_EXCEEDED") {
      throw new Error("Velona image-generation rate limit reached. Try again shortly.");
    }
    if (response.status === 404 || code === "MODEL_NOT_FOUND" || code === "MODEL_NOT_AVAILABLE") {
      throw new Error("The configured Velona image model is unavailable.");
    }
    throw new Error(`Velona image generation failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.data) || !Array.isArray(payload.data.images)) {
    throw new Error("Velona returned an invalid image response.");
  }
  const image = payload.data.images[0];
  if (!isRecord(image)) throw new Error("Velona returned an invalid image response.");

  const encoded = embeddedImageData(image);
  if (
    encoded.length > Math.ceil(MAX_IMAGE_SIZE * 4 / 3) + 4 ||
    !/^[A-Za-z\d+/]+={0,2}$/.test(encoded)
  ) {
    throw new Error("Velona returned invalid image data.");
  }
  const data = Buffer.from(encoded, "base64");
  if (
    data.length === 0 ||
    data.length > MAX_IMAGE_SIZE ||
    data.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")
  ) {
    throw new Error("Velona image must be valid and no larger than 10 MB.");
  }
  const format = imageFormat(data);
  if (
    typeof image.media_type === "string" &&
    image.media_type !== format.contentType
  ) {
    throw new Error("Velona image data did not match its declared format.");
  }

  const fileName = `${randomUUID()}.${format.extension}`;
  await UploadedFile.create({
    folder: input.folder,
    fileName,
    contentType: format.contentType,
    data,
    size: data.length,
    createdBy: input.createdBy,
  });
  return `/api/uploads/file/${input.folder}/${fileName}`;
}
