import { createHmac, timingSafeEqual } from "node:crypto";
import { CAMPAIGN_BANNER_PRESETS } from "@/lib/campaign-banners";
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

function tintColor(color: string, whiteAmount: number) {
  const hex = color.slice(1);
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  return `#${channels.map((channel) => Math.round(channel + (255 - channel) * whiteAmount).toString(16).padStart(2, "0")).join("")}`;
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
    country?: string;
    sellingRate: number;
    min: number;
    max: number;
  }>;
  brandName: string;
  primaryColor: string;
  accentColor: string;
  siteUrl: string;
  backendUrl: string;
  unsubscribeUrl: string;
  banner?: {
    presetId?: string | null;
    imageUrl?: string;
    backgroundImageUrl?: string;
    backgroundColor?: string;
  };
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
  const bannerPreset = input.banner?.presetId && Object.hasOwn(CAMPAIGN_BANNER_PRESETS, input.banner.presetId)
    ? CAMPAIGN_BANNER_PRESETS[input.banner.presetId as keyof typeof CAMPAIGN_BANNER_PRESETS]
    : null;
  const themePrimary = bannerPreset?.colors[0] ?? primaryColor;
  const themeAccent = bannerPreset?.colors[1] ?? accentColor;
  const themeBackground = /^#[\da-fA-F]{6}$/.test(input.banner?.backgroundColor ?? "")
    ? input.banner!.backgroundColor!
    : bannerPreset ? tintColor(bannerPreset.colors[0], 0.92) : "#f1f5f9";
  const cardBackground = bannerPreset ? tintColor(bannerPreset.colors[0], 0.97) : "#ffffff";
  const bannerImageUrl = input.banner?.imageUrl
    ? safeHttpUrl(new URL(input.banner.imageUrl, input.backendUrl).toString())
    : "";
  const emailBackgroundImageUrl = input.banner?.backgroundImageUrl
    ? safeHttpUrl(new URL(input.banner.backgroundImageUrl, input.backendUrl).toString())
    : "";
  const bannerHtml = bannerImageUrl
    ? `<tr><td style="padding:0;font-size:0;line-height:0"><img src="${bannerImageUrl}" alt="Campaign banner" width="640" style="display:block;width:100%;max-width:640px;height:auto;border:0"></td></tr>`
    : bannerPreset
      ? `<tr><td align="center" bgcolor="${bannerPreset.colors[0]}" style="padding:30px 20px;background-color:${bannerPreset.colors[0]};background-image:linear-gradient(120deg,${bannerPreset.colors[0]},${bannerPreset.colors[1]});color:#ffffff;font-family:Arial,Helvetica,sans-serif"><div style="font-size:36px;line-height:1.2">${bannerPreset.emoji}</div><div style="margin-top:8px;font-size:22px;font-weight:700">${escapeHtml(bannerPreset.title)}</div></td></tr>`
      : "";
  const bannerText = bannerPreset ? `\n\n${bannerPreset.title}` : bannerImageUrl ? `\n\nCampaign banner: ${bannerImageUrl}` : "";
  const services = input.services ?? [];
  const serviceText = services.length
    ? `\n\nFeatured services:\n${services.map((service) => `${service.platform}${service.country ? ` · ${service.country}` : ""} · ${service.name} · Rs.${service.sellingRate.toFixed(2)} per 1,000`).join("\n")}`
    : "";
  const serviceCards = services.map((service) => `
    <tr>
      <td style="padding:16px 18px;border-bottom:1px solid #e8edf2">
        <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${accentColor}">${escapeHtml(service.platform)}</div>
        <div style="margin-top:5px;font-size:15px;font-weight:700;color:#243b53">${escapeHtml(service.name)}</div>
        <div style="margin-top:4px;font-size:12px;color:#627d98">${escapeHtml(service.category)}${service.country ? ` · ${escapeHtml(service.country)}` : ""} · Quantity ${service.min.toLocaleString()}–${service.max.toLocaleString()}</div>
      </td>
      <td align="right" style="padding:16px 18px;border-bottom:1px solid #e8edf2;white-space:nowrap">
        <div style="font-size:15px;font-weight:700;color:#243b53">Rs.${service.sellingRate.toFixed(2)}</div>
        <div style="font-size:11px;color:#829ab1">per 1,000</div>
      </td>
    </tr>`).join("");
  const backgroundAttribute = emailBackgroundImageUrl ? ` background="${emailBackgroundImageUrl}"` : "";
  const backgroundImageStyle = emailBackgroundImageUrl
    ? `background-image:url('${emailBackgroundImageUrl}');background-position:center top;background-repeat:no-repeat;background-size:cover;`
    : "";
  return {
    subject,
    text: `${greeting}\n\n${body}${bannerText}${serviceText}\n\n${input.brandName}\n${input.siteUrl}\n\nUnsubscribe: ${input.unsubscribeUrl}`,
    html: `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="${themeBackground}"${backgroundAttribute} style="width:100%;margin:0;padding:0;background-color:${themeBackground};${backgroundImageStyle}font-family:Arial,Helvetica,sans-serif;color:#243b53">
        <tbody><tr><td align="center" style="padding:28px 12px">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" bgcolor="${cardBackground}" style="width:100%;max-width:640px;border:1px solid ${tintColor(themePrimary, 0.82)};border-collapse:collapse;background-color:${cardBackground};color:#243b53">
            <tbody>
              <tr><td bgcolor="${themePrimary}" style="padding:26px 30px;background-color:${themePrimary};background-image:linear-gradient(125deg,${themePrimary} 0%,${themeAccent} 100%);color:#ffffff;font-family:Arial,Helvetica,sans-serif">
                <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${safeBrand}</div>
                <h1 style="margin:14px 0 0;font-size:25px;line-height:1.3">${safeSubject}</h1>
              </td></tr>
              ${bannerHtml}
              <tr><td bgcolor="${cardBackground}" style="padding:26px 30px;background-color:${cardBackground};font-size:15px;line-height:1.8;color:#334155;font-family:Arial,Helvetica,sans-serif">
                ${safeGreeting ? `<p style="margin:0 0 16px;font-weight:700;color:${themePrimary}">${safeGreeting}</p>` : ""}
                <div>${safeBody}</div>
              </td></tr>
              ${serviceCards ? `
                <tr><td bgcolor="${cardBackground}" style="padding:0 24px 24px;background-color:${cardBackground};font-family:Arial,Helvetica,sans-serif">
                  <h2 style="margin:0 0 12px;font-size:16px;color:${themePrimary}">Featured services</h2>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e8edf2;border-collapse:collapse">
                    <tbody>${serviceCards}</tbody>
                  </table>
                  <p style="margin:12px 0 0;text-align:center;font-size:13px"><a href="${safeServicesUrl}" style="color:${themeAccent};font-weight:700;text-decoration:none">Explore all services</a></p>
                </td></tr>
              ` : ""}
              <tr><td bgcolor="${tintColor(themePrimary, 0.94)}" style="padding:18px 24px;border-top:1px solid ${tintColor(themePrimary, 0.85)};background-color:${tintColor(themePrimary, 0.94)};text-align:center;font-size:11px;color:#64748b;font-family:Arial,Helvetica,sans-serif">
                <a href="${safeSiteUrl}" style="color:${themeAccent};text-decoration:none">${safeBrand}</a>
                &nbsp;·&nbsp;
                <a href="${safeUnsubscribeUrl}" style="color:#475569">Unsubscribe from marketing emails</a>
              </td></tr>
            </tbody>
          </table>
        </td></tr></tbody>
      </table>
    `,
  };
}
