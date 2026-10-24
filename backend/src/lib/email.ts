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

export function buildRegistrationOtpEmail(otp: string) {
  const subject = "Verify your SMM Panel email";
  const text = [
    "Your SMM Panel email verification OTP is:",
    otp,
    "",
    "This OTP expires in 10 minutes. If you did not create an account, ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#171717;line-height:1.5">
      <h2 style="margin:0 0 12px">Verify your email</h2>
      <p>Enter this OTP to finish creating your SMM Panel account:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${otp}</p>
      <p>This OTP expires in 10 minutes.</p>
      <p style="color:#525252;font-size:13px">If you did not create an account, ignore this email.</p>
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
