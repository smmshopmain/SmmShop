import nodemailer from "nodemailer";

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

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function sendMail({ to, subject, text, html }: MailInput) {
  const host = requireEnv("SMTP_HOST");
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");
  const from = process.env.EMAIL_FROM || user;

  const transporter = nodemailer.createTransport({
    host,
    port: smtpPort(),
    secure: smtpPort() === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({ from, to, subject, text, html });
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
