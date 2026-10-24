import { createHmac, timingSafeEqual } from "node:crypto";
import { User } from "@/models";

function unsubscribeSignature(payload: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createUnsubscribeToken(userId: string) {
  const payload = `${userId}.${Date.now() + 1000 * 60 * 60 * 24 * 365 * 5}`;
  return `${payload}.${unsubscribeSignature(payload)}`;
}

export async function unsubscribeFromMarketing(token: string) {
  const [userId, expiry, signature, extra] = token.split(".");
  if (!userId || !expiry || !signature || extra) return false;
  if (!/^[a-f\d]{24}$/i.test(userId) || !/^\d+$/.test(expiry) || Number(expiry) < Date.now()) return false;

  const payload = `${userId}.${expiry}`;
  const expected = Buffer.from(unsubscribeSignature(payload), "hex");
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false;

  await User.updateOne(
    { _id: userId },
    { $set: { marketingUnsubscribed: true, marketingUnsubscribedAt: new Date() } },
  );
  return true;
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
  return escapeHtml(url.toString());
}

export function buildCampaignEmail(input: {
  subject: string;
  body: string;
  brandName: string;
  primaryColor: string;
  accentColor: string;
  siteUrl: string;
  unsubscribeUrl: string;
}) {
  const safeBody = escapeHtml(input.body).replace(/\r?\n/g, "<br>");
  const safeBrand = escapeHtml(input.brandName);
  const safeSubject = escapeHtml(input.subject);
  const safeSiteUrl = safeHttpUrl(input.siteUrl);
  const safeUnsubscribeUrl = safeHttpUrl(input.unsubscribeUrl);
  const primaryColor = /^#[\da-fA-F]{6}$/.test(input.primaryColor) ? input.primaryColor : "#0b3038";
  const accentColor = /^#[\da-fA-F]{6}$/.test(input.accentColor) ? input.accentColor : "#087e78";
  return {
    subject: input.subject,
    text: `${input.body}\n\n${input.brandName}\n${input.siteUrl}\n\nUnsubscribe: ${input.unsubscribeUrl}`,
    html: `
      <div style="margin:0;padding:32px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#243b53">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5edf3;border-radius:18px;overflow:hidden">
          <div style="padding:28px 30px;background-color:${primaryColor};background-image:linear-gradient(125deg,${primaryColor} 0%,${accentColor} 100%);color:#ffffff">
            <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${safeBrand}</div>
            <h1 style="margin:14px 0 0;font-size:25px;line-height:1.3">${safeSubject}</h1>
          </div>
          <div style="padding:28px 30px;font-size:15px;line-height:1.8;color:#486581">${safeBody}</div>
          <div style="padding:18px 24px;border-top:1px solid #e8edf2;background:#f7fafc;text-align:center;font-size:11px;color:#829ab1">
            <a href="${safeSiteUrl}" style="color:${accentColor};text-decoration:none">${safeBrand}</a>
            &nbsp;·&nbsp;
            <a href="${safeUnsubscribeUrl}" style="color:#627d98">Unsubscribe from marketing emails</a>
          </div>
        </div>
      </div>
    `,
  };
}
