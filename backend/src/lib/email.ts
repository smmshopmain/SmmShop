import { resolve4 } from "dns/promises";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type MailResult = {
  provider: "smtp";
  messageId?: string;
  accepted: string[];
  rejected: string[];
  response: string;
};

const DNS_TIMEOUT_MS = 5000;
const SMTP_TIMEOUT_MS = 15000;
const SEND_TIMEOUT_MS = 20000;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function smtpPort() {
  const port = Number(requireEnv("SMTP_PORT"));
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a valid port number");
  }
  return port;
}

function smtpSecure() {
  const value = requireEnv("SMTP_SECURE").toLowerCase();
  if (["true", "1", "yes"].includes(value)) return true;
  if (["false", "0", "no"].includes(value)) return false;
  throw new Error("SMTP_SECURE must be true or false");
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function resolveSmtpHost(host: string) {
  try {
    return (await withTimeout(resolve4(host), DNS_TIMEOUT_MS, "SMTP DNS lookup timed out"))[0] ?? host;
  } catch {
    return host;
  }
}

export async function sendMail({ to, subject, text, html }: MailInput): Promise<MailResult> {
  const from = requireEnv("FROM_EMAIL");
  const smtpHost = requireEnv("SMTP_HOST");
  const resolvedHost = await resolveSmtpHost(smtpHost);
  const transportOptions: SMTPTransport.Options = {
    host: resolvedHost,
    port: smtpPort(),
    secure: smtpSecure(),
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
    dnsTimeout: DNS_TIMEOUT_MS,
    tls: {
      servername: smtpHost,
    },
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASS"),
    },
  };
  const transporter = nodemailer.createTransport(transportOptions);

  try {
    const info = await withTimeout(
      transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      }),
      SEND_TIMEOUT_MS,
      "SMTP email delivery timed out",
    );
    const result: MailResult = {
      provider: "smtp",
      messageId: info.messageId,
      accepted: info.accepted.map(String),
      rejected: info.rejected.map(String),
      response: info.response,
    };
    console.info("SMTP email accepted", {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP email delivery failed";
    console.error("SMTP email failed", {
      error: message,
      to,
      subject,
    });
    throw new Error(`Email delivery failed: ${message}`);
  } finally {
    transporter.close();
  }
}

export function buildPasswordOtpEmail(otp: string) {
  const subject = "SMM Panel password reset OTP";
  const text = [
    "Your SMM Panel password reset OTP is:",
    otp,
    "",
    "This OTP expires in 10 minutes. If you did not request this, ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#171717;line-height:1.5">
      <h2 style="margin:0 0 12px">Password reset OTP</h2>
      <p>Your SMM Panel password reset OTP is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${otp}</p>
      <p>This OTP expires in 10 minutes.</p>
      <p style="color:#525252;font-size:13px">If you did not request this, ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
}

export function buildEmailChangeOtpEmail(otp: string) {
  const subject = "SMM Panel email change OTP";
  const text = [
    "Your SMM Panel email change OTP is:",
    otp,
    "",
    "This OTP expires in 10 minutes. If you did not request this, ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#171717;line-height:1.5">
      <h2 style="margin:0 0 12px">Email change OTP</h2>
      <p>Your SMM Panel email change OTP is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${otp}</p>
      <p>This OTP expires in 10 minutes.</p>
      <p style="color:#525252;font-size:13px">If you did not request this, ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
}

export function buildPhoneChangeOtpEmail(otp: string) {
  const subject = "SMM Panel phone change OTP";
  const text = [
    "Your SMM Panel phone change OTP is:",
    otp,
    "",
    "This OTP expires in 10 minutes. If you did not request this, ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#171717;line-height:1.5">
      <h2 style="margin:0 0 12px">Phone change OTP</h2>
      <p>Your SMM Panel phone change OTP is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${otp}</p>
      <p>This OTP expires in 10 minutes.</p>
      <p style="color:#525252;font-size:13px">If you did not request this, ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
}

export function buildPasswordChangeOtpEmail(otp: string) {
  const subject = "SMM Panel password change OTP";
  const text = [
    "Your SMM Panel password change OTP is:",
    otp,
    "",
    "This OTP expires in 10 minutes. If you did not request this, ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#171717;line-height:1.5">
      <h2 style="margin:0 0 12px">Password change OTP</h2>
      <p>Your SMM Panel password change OTP is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${otp}</p>
      <p>This OTP expires in 10 minutes.</p>
      <p style="color:#525252;font-size:13px">If you did not request this, ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
}
