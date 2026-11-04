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
  greeting?: string;
  body: string;
  recipientName: string;
  recipientEmail: string;
  services?: Array<{
    name: string;
    category: string;
    platform: string;
    sellingRate: number;
    min: number;
    max: number;
  }>;
  brandName: string;
  primaryColor: string;
  accentColor: string;
  siteUrl: string;
  unsubscribeUrl: string;
}) {
  const values: Record<string, string> = {
    name: input.recipientName.trim() || "there",
    email: input.recipientEmail,
    brandName: input.brandName,
  };
  const personalize = (value: string) =>
    value.replace(/\{\{([a-zA-Z]+)\}\}/g, (token, key: string) => values[key] ?? token);
  const greeting = personalize(input.greeting ?? "Hello {{name}},");
  const body = personalize(input.body);
  const safeGreeting = escapeHtml(greeting).replace(/\r?\n/g, "<br>");
  const safeBody = escapeHtml(body).replace(/\r?\n/g, "<br>");
  const safeBrand = escapeHtml(input.brandName);
  const subject = personalize(input.subject);
  const safeSubject = escapeHtml(subject);
  const safeSiteUrl = safeHttpUrl(input.siteUrl);
  const safeServicesUrl = safeHttpUrl(new URL("/dashboard/services", input.siteUrl).toString());
  const safeUnsubscribeUrl = safeHttpUrl(input.unsubscribeUrl);
  const primaryColor = /^#[\da-fA-F]{6}$/.test(input.primaryColor) ? input.primaryColor : "#0b3038";
  const accentColor = /^#[\da-fA-F]{6}$/.test(input.accentColor) ? input.accentColor : "#087e78";
  const services = input.services ?? [];
  const serviceText = services.length
    ? `\n\nFeatured services:\n${services.map((service) => `${service.platform} · ${service.name} · Rs.${service.sellingRate.toFixed(2)} per 1,000`).join("\n")}`
    : "";
  const serviceCards = services.map((service) => `
    <tr>
      <td style="padding:16px 18px;border-bottom:1px solid #e8edf2">
        <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${accentColor}">${escapeHtml(service.platform)}</div>
        <div style="margin-top:5px;font-size:15px;font-weight:700;color:#243b53">${escapeHtml(service.name)}</div>
        <div style="margin-top:4px;font-size:12px;color:#627d98">${escapeHtml(service.category)} · Quantity ${service.min.toLocaleString()}–${service.max.toLocaleString()}</div>
      </td>
      <td align="right" style="padding:16px 18px;border-bottom:1px solid #e8edf2;white-space:nowrap">
        <div style="font-size:15px;font-weight:700;color:#243b53">Rs.${service.sellingRate.toFixed(2)}</div>
        <div style="font-size:11px;color:#829ab1">per 1,000</div>
      </td>
    </tr>`).join("");
  return {
    subject,
    text: `${greeting}\n\n${body}${serviceText}\n\n${input.brandName}\n${input.siteUrl}\n\nUnsubscribe: ${input.unsubscribeUrl}`,
    html: `
      <div style="margin:0;padding:32px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#243b53">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5edf3;border-radius:18px;overflow:hidden">
          <div style="padding:28px 30px;background-color:${primaryColor};background-image:linear-gradient(125deg,${primaryColor} 0%,${accentColor} 100%);color:#ffffff">
            <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${safeBrand}</div>
            <h1 style="margin:14px 0 0;font-size:25px;line-height:1.3">${safeSubject}</h1>
          </div>
          <div style="padding:28px 30px;font-size:15px;line-height:1.8;color:#486581">
            ${safeGreeting ? `<p style="margin:0 0 16px;font-weight:700;color:#243b53">${safeGreeting}</p>` : ""}
            <div>${safeBody}</div>
          </div>
          ${serviceCards ? `
            <div style="padding:0 24px 24px">
              <h2 style="margin:0 0 12px;font-size:16px;color:#243b53">Featured services</h2>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e8edf2;border-radius:12px;border-collapse:separate;border-spacing:0;overflow:hidden">
                <tbody>${serviceCards}</tbody>
              </table>
              <p style="margin:12px 0 0;text-align:center;font-size:13px"><a href="${safeServicesUrl}" style="color:${accentColor};font-weight:700;text-decoration:none">Explore all services</a></p>
            </div>
          ` : ""}
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
