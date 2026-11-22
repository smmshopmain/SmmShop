import { Setting } from "@/models";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  inlineImages?: Array<{ cid: string; url: string }>;
};

type MailResult = {
  provider: "smtp";
  messageId?: string;
  accepted: string[];
  rejected: string[];
  response: string;
};

const REQUEST_TIMEOUT_MS = 15000;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function sendViaWorker({ to, subject, text, html, inlineImages }: MailInput) {
  const workerUrl = requireEnv("EMAIL_WORKER_URL");
  const workerSecret = requireEnv("EMAIL_WORKER_SECRET");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-email-worker-secret": workerSecret,
      },
      signal: controller.signal,
      body: JSON.stringify({ to, subject, text, html, inlineImages }),
    });

    let payload: { ok?: boolean; message?: string; messageId?: string } | null = null;
    try {
      payload = (await response.json()) as { ok?: boolean; message?: string; messageId?: string };
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message || `Email worker request failed with status ${response.status}`);
    }

    return {
      messageId: payload.messageId,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sendMail({ to, subject, text, html, inlineImages }: MailInput): Promise<MailResult> {
  try {
    const workerResponse = await sendViaWorker({ to, subject, text, html, inlineImages });
    const result: MailResult = {
      provider: "smtp",
      messageId: workerResponse.messageId,
      accepted: [to],
      rejected: [],
      response: "Email sent via worker",
    };

    console.info("Email worker accepted", {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed";
    console.error("Email worker failed", {
      error: message,
      to,
      subject,
    });
    throw new Error(`Email delivery failed: ${message}`);
  }
}

async function siteBrand() {
  const record = await Setting.findOne({ key: "siteFooter" }).select("value").lean();
  const value = record?.value as { brandName?: unknown; brandLogoUrl?: unknown } | undefined;
  const brandName = typeof value?.brandName === "string" && value.brandName.trim()
    ? value.brandName.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80)
    : "SMM Panel";
  const brandLogoUrl = typeof value?.brandLogoUrl === "string"
    && /^\/api\/uploads\/file\/brand-assets\/[a-f\d-]+\.(?:jpg|png|webp)$/i.test(value.brandLogoUrl)
    ? value.brandLogoUrl
    : "";
  if (!brandLogoUrl) return { brandName, logo: null };
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!apiBase) throw new Error("NEXT_PUBLIC_API_URL is required to include the uploaded brand logo in email.");
  const baseUrl = new URL(apiBase);
  const url = new URL(brandLogoUrl, baseUrl);
  if (url.origin !== baseUrl.origin) throw new Error("Brand logo URL must use the configured API host.");
  return { brandName, logo: { cid: "brand-logo", url: url.toString() } };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function buildOtpEmail(otp: string, subjectLabel: string, heading: string) {
  const { brandName, logo } = await siteBrand();
  const safeBrand = escapeHtml(brandName);
  const subject = `${brandName} ${subjectLabel}`;
  const text = [
    `Your ${brandName} ${subjectLabel} is:`,
    otp,
    "",
    "This OTP expires in 10 minutes. If you did not request this, ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#171717;line-height:1.5">
      <div style="display:flex;align-items:center;gap:12px">${logo ? `<img src="cid:${logo.cid}" alt="" width="42" height="42" style="width:42px;height:42px;border-radius:50%;object-fit:cover">` : ""}<strong>${safeBrand}</strong></div>
      <h2 style="margin:16px 0 12px">${escapeHtml(heading)}</h2>
      <p>Your ${safeBrand} ${escapeHtml(subjectLabel)} is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${otp}</p>
      <p>This OTP expires in 10 minutes.</p>
      <p style="color:#525252;font-size:13px">If you did not request this, ignore this email.</p>
    </div>
  `;

  return { subject, text, html, ...(logo ? { inlineImages: [logo] } : {}) };
}

export function buildPasswordOtpEmail(otp: string) {
  return buildOtpEmail(otp, "password reset OTP", "Password reset OTP");
}

export function buildEmailChangeOtpEmail(otp: string) {
  return buildOtpEmail(otp, "email change OTP", "Email change OTP");
}

export function buildPhoneChangeOtpEmail(otp: string) {
  return buildOtpEmail(otp, "phone change OTP", "Phone change OTP");
}

export function buildPasswordChangeOtpEmail(otp: string) {
  return buildOtpEmail(otp, "password change OTP", "Password change OTP");
}
