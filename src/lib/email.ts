type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type MailResult = {
  provider: "resend";
  messageId?: string;
  accepted: string[];
  rejected: string[];
  response: string;
};

const RESEND_EMAIL_URL = "https://api.resend.com/emails";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function readResendResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function resendErrorMessage(raw: unknown) {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const nestedError = record.error && typeof record.error === "object" ? record.error as Record<string, unknown> : null;
    return String(
      nestedError?.message ??
        record.message ??
        record.error ??
        record.name ??
        JSON.stringify(record),
    );
  }
  return String(raw);
}

export async function sendMail({ to, subject, text, html }: MailInput): Promise<MailResult> {
  const apiKey = requireEnv("RESEND_API_KEY");
  const from = requireEnv("EMAIL_FROM");

  const response = await fetch(RESEND_EMAIL_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "user-agent": "smm-shop/1.0",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
    }),
  });
  const raw = await readResendResponse(response);

  if (!response.ok) {
    const message = resendErrorMessage(raw) || response.statusText || "Resend email API failed";
    console.error("Resend email failed", {
      status: response.status,
      response: message,
      to,
      subject,
    });
    throw new Error(`Email delivery failed: ${message}`);
  }

  const record = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
  const result: MailResult = {
    provider: "resend",
    messageId: typeof record.id === "string" ? record.id : undefined,
    accepted: [to],
    rejected: [],
    response: `${response.status} ${response.statusText}`,
  };
  console.info("Resend email accepted", {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
    response: result.response,
  });
  return result;
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
