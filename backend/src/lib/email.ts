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

type MailResult = {
  provider: string;
  messageId?: string;
  accepted: string[];
  rejected: string[];
  response?: string;
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

async function readProviderResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function providerMessage(raw: unknown) {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null) {
    const record = raw as Record<string, unknown>;
    return String(record.message ?? record.error ?? record.errors ?? JSON.stringify(record));
  }
  return String(raw);
}

function mailAddresses(values: unknown[]) {
  return values.map((value) => (typeof value === "string" ? value : JSON.stringify(value)));
}

async function postMailProvider({
  provider,
  url,
  headers,
  body,
  to,
}: {
  provider: string;
  url: string;
  headers: HeadersInit;
  body: unknown;
  to: string;
}): Promise<MailResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const raw = await readProviderResponse(response);
  if (!response.ok) {
    throw new Error(`${provider} email API failed: ${providerMessage(raw) || response.statusText}`);
  }

  const record = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const messageId = String(record.id ?? record.messageId ?? record.message_id ?? "");
  return {
    provider,
    messageId: messageId || undefined,
    accepted: [to],
    rejected: [],
    response: `${response.status} ${response.statusText}`,
  };
}

async function sendWithHttpProvider(input: MailInput & { from: string }): Promise<MailResult | null> {
  if (process.env.RESEND_API_KEY) {
    return postMailProvider({
      provider: "resend",
      url: "https://api.resend.com/emails",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: {
        from: input.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      },
      to: input.to,
    });
  }

  if (process.env.BREVO_API_KEY) {
    return postMailProvider({
      provider: "brevo",
      url: "https://api.brevo.com/v3/smtp/email",
      headers: { "api-key": process.env.BREVO_API_KEY },
      body: {
        sender: { email: input.from },
        to: [{ email: input.to }],
        subject: input.subject,
        textContent: input.text,
        htmlContent: input.html,
      },
      to: input.to,
    });
  }

  if (process.env.SENDGRID_API_KEY) {
    return postMailProvider({
      provider: "sendgrid",
      url: "https://api.sendgrid.com/v3/mail/send",
      headers: { authorization: `Bearer ${process.env.SENDGRID_API_KEY}` },
      body: {
        personalizations: [{ to: [{ email: input.to }] }],
        from: { email: input.from },
        subject: input.subject,
        content: [
          { type: "text/plain", value: input.text },
          ...(input.html ? [{ type: "text/html", value: input.html }] : []),
        ],
      },
      to: input.to,
    });
  }

  if (process.env.EMAIL_API_URL) {
    return postMailProvider({
      provider: "custom-email-api",
      url: process.env.EMAIL_API_URL,
      headers: process.env.EMAIL_API_KEY ? { authorization: `Bearer ${process.env.EMAIL_API_KEY}` } : {},
      body: input,
      to: input.to,
    });
  }

  return null;
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
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("EMAIL_FROM or SMTP_USER is not configured");

  const providerInfo = await sendWithHttpProvider({ to, subject, text, html, from });
  if (providerInfo) {
    console.info("Email API accepted", providerInfo);
    return providerInfo;
  }

  const host = requireEnv("SMTP_HOST");
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");
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

  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    const result: MailResult = {
      provider: "smtp",
      messageId: info.messageId,
      accepted: mailAddresses(info.accepted),
      rejected: mailAddresses(info.rejected),
      response: info.response,
    };
    console.info("SMTP sendMail accepted", result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP send failed";
    if (/timeout|etimedout|econnrefused|network is unreachable/i.test(message)) {
      throw new Error(
        "Email delivery connection timed out. Render free instances block outbound SMTP ports; configure RESEND_API_KEY, BREVO_API_KEY, SENDGRID_API_KEY, EMAIL_API_URL, or use a paid backend instance for SMTP.",
      );
    }
    throw error;
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
