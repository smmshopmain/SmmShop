import { resolve4 } from "dns/promises";
import { isIP } from "net";
import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function smtpPort() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return Number.isFinite(port) ? port : 587;
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function smtpConnectionHost(host: string) {
  if (numberEnv("SMTP_FAMILY", 4) !== 4 || isIP(host)) return host;
  const timeoutMs = numberEnv("SMTP_DNS_TIMEOUT_MS", 5000);
  try {
    const addresses = await Promise.race([
      resolve4(host),
      new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error("SMTP IPv4 DNS timeout")), timeoutMs)),
    ]);
    return addresses[0] ?? host;
  } catch {
    return host;
  }
}

export async function sendMail({ to, subject, text, html }: MailInput) {
  const host = requireEnv("SMTP_HOST");
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");
  const from = process.env.EMAIL_FROM || user;
  const connectionHost = await smtpConnectionHost(host);

  const options: SMTPTransport.Options = {
    host: connectionHost,
    port: smtpPort(),
    secure: smtpPort() === 465,
    auth: { user, pass },
    connectionTimeout: numberEnv("SMTP_CONNECTION_TIMEOUT_MS", 20000),
    greetingTimeout: numberEnv("SMTP_GREETING_TIMEOUT_MS", 20000),
    socketTimeout: numberEnv("SMTP_SOCKET_TIMEOUT_MS", 30000),
    dnsTimeout: numberEnv("SMTP_DNS_TIMEOUT_MS", 5000),
    tls: connectionHost !== host ? { servername: host } : undefined,
  };
  const transporter = nodemailer.createTransport(options);

  const info = await transporter.sendMail({ from, to, subject, text, html });
  console.info("SMTP sendMail accepted", {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  });
  return info;
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
