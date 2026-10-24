import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

type SendEmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
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
  return typeof candidate.to === "string" && typeof candidate.subject === "string" && typeof candidate.text === "string";
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
