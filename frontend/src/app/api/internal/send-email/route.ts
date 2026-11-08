import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

type SendEmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  inlineImages?: Array<{ cid: string; url: string }>;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function parseBoolean(value: string) {
  const normalized = value.toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new Error("SMTP_SECURE must be true or false");
}

function parsePort(value: string) {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a valid port number");
  }
  return port;
}

function isValidPayload(value: unknown): value is SendEmailPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<SendEmailPayload>;
  return typeof candidate.to === "string"
    && typeof candidate.subject === "string"
    && typeof candidate.text === "string"
    && (candidate.inlineImages === undefined || (
      Array.isArray(candidate.inlineImages)
      && candidate.inlineImages.length <= 2
      && candidate.inlineImages.every((image) =>
        image !== null
        && typeof image === "object"
        && ["campaign-banner", "campaign-background"].includes(image.cid)
        && typeof image.url === "string",
      )
    ));
}

async function fetchInlineImage(image: { cid: string; url: string }) {
  const apiBase = new URL(requireEnv("NEXT_PUBLIC_API_URL"));
  const url = new URL(image.url);
  if (
    url.origin !== apiBase.origin
    || !/^\/api\/uploads\/file\/campaign-banners\/[a-f\d-]+\.(?:jpg|png|webp)$/i.test(url.pathname)
  ) {
    throw new Error("Campaign email image URL is invalid.");
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Campaign email image could not be loaded (HTTP ${response.status}).`);

  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "image/jpeg" && contentType !== "image/png" && contentType !== "image/webp") {
    throw new Error("Campaign email image has an unsupported content type.");
  }

  const data = Buffer.from(await response.arrayBuffer());
  if (data.length === 0 || data.length > 10 * 1024 * 1024) {
    throw new Error("Campaign email image must be between 1 byte and 10MB.");
  }

  return {
    cid: image.cid,
    filename: `${image.cid}.${contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length)}`,
    contentType,
    content: data,
  };
}

export async function POST(request: NextRequest) {
  const sharedSecret = request.headers.get("x-email-worker-secret");
  if (!sharedSecret || sharedSecret !== process.env.EMAIL_WORKER_SECRET) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidPayload(payload)) {
    return NextResponse.json(
      { ok: false, message: "Body must include to, subject, and text strings" },
      { status: 400 },
    );
  }

  try {
    const attachments = await Promise.all((payload.inlineImages ?? []).map(fetchInlineImage));
    const transporter = nodemailer.createTransport({
      host: requireEnv("SMTP_HOST"),
      port: parsePort(requireEnv("SMTP_PORT")),
      secure: parseBoolean(requireEnv("SMTP_SECURE")),
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      auth: {
        user: requireEnv("SMTP_USER"),
        pass: requireEnv("SMTP_PASS"),
      },
    });

    try {
      const info = await transporter.sendMail({
        from: requireEnv("FROM_EMAIL"),
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        attachments,
      });

      if (info.accepted.length === 0 || info.rejected.length > 0) {
        throw new Error("SMTP did not accept the recipient.");
      }

      return NextResponse.json({ ok: true, messageId: info.messageId });
    } finally {
      transporter.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    console.error("Internal email worker failed", { error: message });
    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}

export function GET() {
  return NextResponse.json({ ok: false, message: "Method not allowed" }, { status: 405 });
}
