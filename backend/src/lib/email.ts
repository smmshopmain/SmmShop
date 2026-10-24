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

export function buildRegistrationOtpEmail(otp: string, phone: string) {
  const subject = "Verify your SMM Panel email";
  const text = [
    "Your SMM Panel email verification OTP is:",
    otp,
    "",
    `Mobile number entered for registration: ${phone}`,
    "",
    "This OTP expires in 10 minutes. If you did not create an account, ignore this email.",
  ].join("\n");
  const safePhone = escapeHtml(phone);
  const html = `
    <div style="margin:0;padding:32px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#243b53">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5edf3;border-radius:18px;overflow:hidden">
        <div style="padding:28px 30px;background-color:#0b3038;background-image:linear-gradient(125deg,#0b3038 0%,#087e78 100%);color:#ffffff">
          <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#b6f2e9">SMM PANEL · EMAIL VERIFICATION</div>
          <h1 style="margin:16px 0 8px;font-size:26px;line-height:1.25;color:#ffffff">Confirm your email</h1>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#d8f5f0">One quick step to activate your growth workspace.</p>
        </div>
        <div style="padding:28px 30px">
          <p style="margin:0;font-size:14px;line-height:1.7;color:#486581">Enter this verification code to finish creating your account:</p>
          <div style="margin:18px 0;padding:17px;border:1px solid #bfe8df;border-radius:12px;background:#effaf8;text-align:center;font-size:30px;font-weight:800;letter-spacing:7px;color:#087e78">${otp}</div>
          <div style="padding:14px 16px;border:1px solid #e8edf2;border-radius:12px;background:#f7fafc">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#829ab1">Mobile number for this registration</div>
            <div style="margin-top:6px;font-size:15px;font-weight:700;color:#243b53">${safePhone}</div>
          </div>
          <p style="margin:18px 0 0;font-size:12px;line-height:1.7;color:#627d98">This code expires in 10 minutes. If you did not start this registration, you can ignore this email.</p>
        </div>
        <div style="padding:16px 24px;border-top:1px solid #e8edf2;background:#f7fafc;text-align:center;font-size:11px;color:#829ab1">SMM Panel · Your growth workspace</div>
      </div>
    </div>
  `;

  return { subject, text, html };
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

export function buildWelcomeEmail({
  name,
  email,
  phone,
  siteUrl,
  activeServiceCount,
  activeCategoryCount,
  services,
}: WelcomeEmailInput) {
  const subject = "Welcome to SMM Panel — your growth workspace is ready";
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone?.trim() || "Not added yet");
  const safeSiteUrl = escapeHtml(siteUrl);
  const serviceLines = services.length
    ? services.map((service) =>
        `${service.name} · ${service.category} · Rs.${service.sellingRate.toFixed(2)} per 1,000`,
      )
    : ["No active services are listed right now. Visit the catalog again soon."];
  const text = [
    `Welcome to SMM Panel, ${name}!`,
    "",
    "Your account is ready. Explore social growth services, manage your wallet, track orders, and get support from one workspace.",
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
    "SMM Panel — your growth workspace",
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
                <div style="font-size:14px;font-weight:700;color:#087e78">Rs.${service.sellingRate.toFixed(2)}</div>
                <div style="margin-top:4px;font-size:11px;color:#829ab1">per 1,000</div>
              </td>
            </tr>`,
        )
        .join("")
    : `<tr><td style="padding:16px;color:#627d98">No active services are listed right now. Visit the catalog again soon.</td></tr>`;
  const html = `
    <div style="margin:0;padding:32px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#243b53">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5edf3;border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(15,35,55,.12)">
        <div style="padding:36px 34px;background-color:#0b3038;background-image:linear-gradient(125deg,#0b3038 0%,#087e78 58%,#1aa7a1 100%);color:#ffffff">
          <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#b6f2e9">SMM PANEL · YOUR GROWTH WORKSPACE</div>
          <h1 style="margin:18px 0 10px;font-size:30px;line-height:1.2;color:#ffffff">Welcome aboard, ${safeName}!</h1>
          <p style="margin:0;max-width:460px;font-size:15px;line-height:1.7;color:#d8f5f0">Your account is ready. Discover services, manage orders, and follow your progress from one clear workspace.</p>
          <a href="${safeSiteUrl}/dashboard/services" style="display:inline-block;margin-top:24px;padding:13px 20px;border-radius:10px;background:#ffffff;color:#075e59;text-decoration:none;font-size:14px;font-weight:700">Explore services&nbsp; →</a>
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
            <a href="${safeSiteUrl}/login" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#087e78;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700">Open your workspace</a>
          </div>
        </div>
        <div style="padding:18px 28px;background:#f7fafc;border-top:1px solid #e8edf2;text-align:center;font-size:11px;line-height:1.7;color:#829ab1">
          SMM Panel · Your growth workspace<br>
          <a href="${safeSiteUrl}" style="color:#087e78;text-decoration:none">${safeSiteUrl}</a>
        </div>
      </div>
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
