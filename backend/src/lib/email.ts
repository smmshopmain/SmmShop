import { DEFAULT_EMAIL_MANAGEMENT_SETTINGS, Setting, type EmailManagementSettings } from "@/models";

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

const REQUEST_TIMEOUT_MS = 15000;
const OTP_EXPIRY_MINUTES = 10;

async function emailSettings(): Promise<EmailManagementSettings> {
  const record = await Setting.findOne({ key: "email" }).lean();
  if (!record?.value || typeof record.value !== "object" || Array.isArray(record.value)) {
    return DEFAULT_EMAIL_MANAGEMENT_SETTINGS;
  }
  const value = record.value as Partial<EmailManagementSettings>;
  const templates = value.templates && typeof value.templates === "object" && !Array.isArray(value.templates)
    ? value.templates as Record<string, unknown>
    : {};
  const isColor = (color: unknown, fallback: string) =>
    typeof color === "string" && /^#[\da-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
  const isTemplate = <T extends Record<string, string>>(candidate: unknown, fallback: T): T => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return fallback;
    const result = { ...fallback };
    for (const key of Object.keys(fallback) as Array<keyof T>) {
      const entry = (candidate as Record<string, unknown>)[key as string];
      if (typeof entry === "string") result[key] = entry as T[keyof T];
    }
    return result;
  };
  return {
    ...DEFAULT_EMAIL_MANAGEMENT_SETTINGS,
    ...value,
    brandName:
      typeof value.brandName === "string" && value.brandName.trim()
        ? value.brandName.trim().slice(0, 60)
        : DEFAULT_EMAIL_MANAGEMENT_SETTINGS.brandName,
    primaryColor: isColor(value.primaryColor, DEFAULT_EMAIL_MANAGEMENT_SETTINGS.primaryColor),
    accentColor: isColor(value.accentColor, DEFAULT_EMAIL_MANAGEMENT_SETTINGS.accentColor),
    templates: {
      registrationOtp: isTemplate(templates.registrationOtp, DEFAULT_EMAIL_MANAGEMENT_SETTINGS.templates.registrationOtp),
      forgotPasswordOtp: isTemplate(templates.forgotPasswordOtp, DEFAULT_EMAIL_MANAGEMENT_SETTINGS.templates.forgotPasswordOtp),
      verificationOtp: isTemplate(templates.verificationOtp, DEFAULT_EMAIL_MANAGEMENT_SETTINGS.templates.verificationOtp),
      welcome: isTemplate(templates.welcome, DEFAULT_EMAIL_MANAGEMENT_SETTINGS.templates.welcome),
    },
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function safeHttpUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Email links must use HTTP or HTTPS.");
  }
  return escapeHtml(url.toString().replace(/\/$/, ""));
}

function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{([a-zA-Z]+)\}\}/g, (token, key: string) => values[key] ?? token);
}

function asHtmlParagraphs(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function sendViaWorker({ to, subject, text, html }: MailInput) {
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
      body: JSON.stringify({ to, subject, text, html }),
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

export async function sendMail({ to, subject, text, html }: MailInput): Promise<MailResult> {
  try {
    const workerResponse = await sendViaWorker({ to, subject, text, html });
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

type OtpTemplateKey = "registrationOtp" | "forgotPasswordOtp" | "verificationOtp";

async function buildOtpEmail(
  templateKey: OtpTemplateKey,
  otp: string,
  values: Record<string, string>,
  heading: string,
) {
  const settings = await emailSettings();
  const template = settings.templates[templateKey];
  const variables = { ...values, otp, expiryMinutes: String(OTP_EXPIRY_MINUTES) };
  const body = interpolate(template.body, variables);
  const subject = interpolate(template.subject, variables);
  const html = `
    <div style="margin:0;padding:32px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#243b53">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5edf3;border-radius:18px;overflow:hidden">
        <div style="padding:28px 30px;background-color:${settings.primaryColor};background-image:linear-gradient(125deg,${settings.primaryColor} 0%,${settings.accentColor} 100%);color:#ffffff">
          <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#b6f2e9">${escapeHtml(settings.brandName)}</div>
          <h1 style="margin:16px 0 8px;font-size:26px;line-height:1.25;color:#ffffff">${escapeHtml(heading)}</h1>
        </div>
        <div style="padding:28px 30px">
          <p style="margin:0;font-size:14px;line-height:1.8;color:#486581">${asHtmlParagraphs(body)}</p>
          <div style="margin:18px 0;padding:17px;border:1px solid #bfe8df;border-radius:12px;background:#effaf8;text-align:center;font-size:30px;font-weight:800;letter-spacing:7px;color:${settings.accentColor}">${escapeHtml(otp)}</div>
          <p style="margin:0;font-size:12px;line-height:1.7;color:#627d98">This code expires in ${OTP_EXPIRY_MINUTES} minutes. Never share it with anyone.</p>
        </div>
        <div style="padding:16px 24px;border-top:1px solid #e8edf2;background:#f7fafc;text-align:center;font-size:11px;color:#829ab1">${escapeHtml(settings.brandName)}</div>
      </div>
    </div>
  `;
  return { subject, text: `${body}\n\nOTP: ${otp}\nExpires in ${OTP_EXPIRY_MINUTES} minutes.`, html };
}

export function buildPasswordOtpEmail(otp: string) {
  return buildOtpEmail("forgotPasswordOtp", otp, {}, "Password reset");
}

export function buildRegistrationOtpEmail(otp: string, phone: string) {
  return buildOtpEmail("registrationOtp", otp, { phone }, "Confirm your email");
}

export function buildVerificationOtpEmail(otp: string, purpose: string) {
  return buildOtpEmail("verificationOtp", otp, { purpose }, "Verify your account");
}

type WelcomeEmailInput = {
  name: string;
  email: string;
  phone?: string;
  siteUrl: string;
  activeServiceCount: number;
  activeCategoryCount: number;
  services: Array<{ name: string; category: string; sellingRate: number }>;
};

export async function buildWelcomeEmail({
  name,
  email,
  phone,
  siteUrl,
  activeServiceCount,
  activeCategoryCount,
  services,
}: WelcomeEmailInput) {
  const settings = await emailSettings();
  const values = { name, email, phone: phone?.trim() || "Not added yet", websiteUrl: siteUrl };
  const template = settings.templates.welcome;
  const subject = interpolate(template.subject, values);
  const headline = interpolate(template.headline, values);
  const welcomeBody = interpolate(template.body, values);
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(values.phone);
  const safeSiteUrl = safeHttpUrl(siteUrl);
  const serviceLines = services.length
    ? services.map((service) =>
        `${service.name} · ${service.category} · Rs.${service.sellingRate.toFixed(2)} per 1,000`,
      )
    : ["No active services are listed right now. Visit the catalog again soon."];
  const text = [
    interpolate(template.headline, values),
    "",
    welcomeBody,
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Mobile: ${phone?.trim() || "Not added yet"}`,
    "",
    "Your password was set during signup and is not included in this email. If you forget it, reset it securely here:",
    `${siteUrl}/forgot-password`,
    "",
    `Explore the live catalog: ${siteUrl}/dashboard/services`,
    `${activeServiceCount} active services across ${activeCategoryCount} categories`,
    "",
    "Some services available now:",
    ...serviceLines,
    "",
    "Sign in to get started:",
    `${siteUrl}/login`,
    "",
    `${settings.brandName} — your growth workspace`,
  ].join("\n");
  const serviceCards = services.length
    ? services
        .map(
          (service) => `
            <tr>
              <td style="padding:14px 16px;border-bottom:1px solid #e8edf2">
                <div style="font-size:14px;font-weight:700;color:#102a43">${escapeHtml(service.name)}</div>
                <div style="margin-top:4px;font-size:12px;color:#627d98">${escapeHtml(service.category)}</div>
              </td>
              <td align="right" style="padding:14px 16px;border-bottom:1px solid #e8edf2;white-space:nowrap">
                <div style="font-size:14px;font-weight:700;color:${settings.accentColor}">Rs.${service.sellingRate.toFixed(2)}</div>
                <div style="margin-top:4px;font-size:11px;color:#829ab1">per 1,000</div>
              </td>
            </tr>`,
        )
        .join("")
    : `<tr><td style="padding:16px;color:#627d98">No active services are listed right now. Visit the catalog again soon.</td></tr>`;
  const html = `
    <div style="margin:0;padding:32px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#243b53">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5edf3;border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(15,35,55,.12)">
        <div style="padding:36px 34px;background-color:${settings.primaryColor};background-image:linear-gradient(125deg,${settings.primaryColor} 0%,${settings.accentColor} 100%);color:#ffffff">
          <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#b6f2e9">${escapeHtml(settings.brandName)} · YOUR GROWTH WORKSPACE</div>
          <h1 style="margin:18px 0 10px;font-size:30px;line-height:1.2;color:#ffffff">${escapeHtml(headline)}</h1>
          <p style="margin:0;max-width:460px;font-size:15px;line-height:1.7;color:#d8f5f0">${asHtmlParagraphs(welcomeBody)}</p>
          <a href="${safeSiteUrl}/dashboard/services" style="display:inline-block;margin-top:24px;padding:13px 20px;border-radius:10px;background:#ffffff;color:${settings.accentColor};text-decoration:none;font-size:14px;font-weight:700">Explore services&nbsp; →</a>
        </div>
        <div style="padding:28px 34px">
          <h2 style="margin:0 0 15px;font-size:17px;color:#102a43">Your account details</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse;background:#f7fafc;border:1px solid #e8edf2;border-radius:12px">
            <tr><td style="padding:11px 14px;font-size:13px;color:#627d98">Name</td><td align="right" style="padding:11px 14px;font-size:13px;font-weight:700;color:#243b53">${safeName}</td></tr>
            <tr><td style="padding:11px 14px;border-top:1px solid #e8edf2;font-size:13px;color:#627d98">Email</td><td align="right" style="padding:11px 14px;border-top:1px solid #e8edf2;font-size:13px;font-weight:700;color:#243b53">${safeEmail}</td></tr>
            <tr><td style="padding:11px 14px;border-top:1px solid #e8edf2;font-size:13px;color:#627d98">Mobile</td><td align="right" style="padding:11px 14px;border-top:1px solid #e8edf2;font-size:13px;font-weight:700;color:#243b53">${safePhone}</td></tr>
          </table>
          <div style="margin-top:16px;padding:14px 16px;border:1px solid #d8e9f3;border-radius:12px;background:#f3f9fc;font-size:12px;line-height:1.7;color:#486581">
            Your password was set during signup and is never sent by email. If you forget it, <a href="${safeSiteUrl}/forgot-password" style="color:#087e78;font-weight:700">reset it securely</a>.
          </div>
          <div style="margin-top:27px;padding:18px 20px;border-radius:14px;background:#effaf8">
            <div style="font-size:22px;font-weight:800;color:#087e78">${activeServiceCount.toLocaleString("en-IN")} active services</div>
            <div style="margin-top:4px;font-size:13px;color:#486581">Across ${activeCategoryCount.toLocaleString("en-IN")} categories · live catalog snapshot</div>
          </div>
          <h2 style="margin:28px 0 6px;font-size:17px;color:#102a43">Available right now</h2>
          <p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:#627d98">A few services from the live catalog. Availability and prices may change.</p>
          <table role="presentation" style="width:100%;border:1px solid #e8edf2;border-radius:12px;border-collapse:separate;border-spacing:0;overflow:hidden">${serviceCards}</table>
          <div style="margin-top:26px">
            <div style="font-size:14px;font-weight:700;color:#102a43">Everything you need, in one place</div>
            <p style="margin:8px 0 0;font-size:13px;line-height:1.8;color:#627d98">Browse social growth services, keep track of your wallet and orders, and reach support whenever you need help.</p>
          </div>
          <div style="margin-top:24px;text-align:center">
            <a href="${safeSiteUrl}/login" style="display:inline-block;padding:13px 22px;border-radius:10px;background:${settings.accentColor};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700">Open your workspace</a>
          </div>
        </div>
        <div style="padding:18px 28px;background:#f7fafc;border-top:1px solid #e8edf2;text-align:center;font-size:11px;line-height:1.7;color:#829ab1">
          ${escapeHtml(settings.brandName)} · Your growth workspace<br>
          <a href="${safeSiteUrl}" style="color:${settings.accentColor};text-decoration:none">${safeSiteUrl}</a>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
}

export function buildEmailChangeOtpEmail(otp: string) {
  return buildVerificationOtpEmail(otp, "email change");
}

export function buildPhoneChangeOtpEmail(otp: string) {
  return buildVerificationOtpEmail(otp, "phone change");
}

export function buildPasswordChangeOtpEmail(otp: string) {
  return buildVerificationOtpEmail(otp, "password change");
}
