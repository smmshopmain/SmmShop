import type { PlatformSettings } from "@/models";

function quoteSetting(value: string, maxLength = 200) {
  const sanitized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return `"${sanitized.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function getReferralSummary(settings: PlatformSettings) {
  if (!settings.referrals.enabled) return "The referral program is currently disabled.";
  const reward = settings.referrals.commissionAmount > 0
    ? `a one-time fixed Rs.${settings.referrals.commissionAmount} reward`
    : `a one-time ${settings.referrals.commissionPercent}% reward on an eligible referred user's wallet deposit`;
  const threshold = settings.referrals.minimumReferredWalletAddAmount > 0
    ? ` after the referred user's total deposits reach Rs.${settings.referrals.minimumReferredWalletAddAmount}`
    : "";
  return `The referral program is enabled and currently awards ${reward}${threshold}.`;
}

function getDeveloperCreditSummary(settings: PlatformSettings, admin: boolean) {
  const credit = settings.developerCredit;
  const isPubliclyVisible = settings.siteFooter.enabled && credit.enabled && Boolean(credit.name.trim());
  if (isPubliclyVisible) {
    return `The published developer credit is ${quoteSetting(credit.label)}: ${quoteSetting(credit.name, 80)}${credit.url ? ` (${quoteSetting(credit.url, 2048)})` : ""}.`;
  }
  if (!admin) return "No developer name is currently published in the website footer; do not guess who built the site.";
  if (credit.name.trim()) {
    return `The developer credit is not currently public. Admin setting value: ${quoteSetting(credit.label)}: ${quoteSetting(credit.name, 80)}${credit.url ? ` (${quoteSetting(credit.url, 2048)})` : ""}.`;
  }
  return "No developer name is configured in the developer-credit setting. Do not infer one from repository authors or technology vendors.";
}

export function buildAssistantWebsiteKnowledge(settings: PlatformSettings, admin: boolean) {
  const brandName = quoteSetting(settings.siteFooter.brandName.trim() || "SMM Panel", 80);
  const themeNames: Record<PlatformSettings["appearance"]["designPreset"], string> = {
    default: "Classic",
    studio: "Studio",
    orbit: "Orbit",
    atelier: "Atelier",
    pulse: "Pulse",
    midnight: "Midnight Studio",
    meridian: "Meridian Executive",
    sage: "Sage Workspace",
    ledger: "Ledger Editorial",
  };
  const publicFacts = [
    `Product identity: ${brandName} is a social-media marketing (SMM) reseller workspace. It brings a social-service catalog, customer orders, wallet, referrals, notifications, and support into one account.`,
    "Customer navigation: Home (dashboard summary), Explore (search/filter the active service catalog and place an order), My orders (track status and eligible cancellation/refill actions), Refills (track requests for eligible completed orders), My wallet (balance, deposits, and transaction history), Invite & earn (referral code and rewards), Get help (support tickets), Updates (notifications), and My account (profile).",
    "Customer order flow: choose an active service, use a valid public HTTP(S) target link, and enter a quantity within that service's minimum/maximum. The system calculates the price from the live service rate, applies a valid optional promo code, and charges the customer's available wallet balance. An order is queued/submitted to its provider and its provider-reported status is shown in My orders; do not promise completion time or results.",
    "Wallet and support: deposit payment instructions are configured by the site and shown in My wallet. Deposit requests are verified before wallet credit; verification can be manual or automatic according to the site's settings. Customers can review their own wallet activity and ask for help with a support ticket. Do not ask them to share passwords, OTPs, payment proofs, or UTRs in chat.",
    "Service catalog and prices change. Never invent service names, availability, rates, order status, or a user's balance. Search active services or the signed-in user's own recent orders with the available tools; direct the customer to the relevant dashboard screen for other live data.",
    "Account access: registration uses email verification; Google sign-in is available only when enabled in site settings. The public website also includes sign-in, registration, and password recovery.",
    "Order statuses can include Scheduled, Pending, Processing, In Progress, Completed, Partial, Canceled, and Failed; explain an individual order only from its live record. Refill and cancellation options depend on service/order eligibility.",
    "The public site may show administrator-managed announcement/advertisement popups and a configurable footer. The user-facing workspace supports theme-matched layouts and responsive screens. Each account has a private assistant conversation history; the assistant greets by the profile name when history is first created, and the movable assistant launcher is available in signed-in workspaces.",
    `Current public settings: site footer ${settings.siteFooter.enabled ? "enabled" : "disabled"}; referral program: ${getReferralSummary(settings)}; Google sign-in ${settings.auth.googleEnabled ? "enabled" : "disabled"}; design preset ${themeNames[settings.appearance.designPreset]}; animations ${settings.appearance.animationsEnabled ? "enabled" : "disabled"}.`,
    `Developer identity: ${getDeveloperCreditSummary(settings, admin)}`,
  ];

  if (!admin) {
    return [
      ...publicFacts,
      "Customer AI scope: list active-service categories, search public active services, show only this signed-in customer's recent orders, and create a support ticket only after explicit confirmation. It cannot place, cancel, or refill orders; change a wallet/account; approve deposits; or access another user's data. Explain the correct website screen for actions the assistant cannot perform.",
      "Answer in the customer's language. Use the site facts above as the source of truth; if something is not listed or available through a tool, say so plainly and direct the customer to the right section or support.",
    ].join("\n");
  }

  return [
    ...publicFacts,
    "Admin navigation and responsibilities: Admin overview shows operational counts; Users manages account access and wallet controls; Orders searches and manages customer orders; Deposits reviews wallet funding; Service Admin manages the catalog; Providers controls provider availability/priority and synchronization; Margins controls global/category/service pricing; Promo Codes manages discounts; Support manages tickets; Notifications sends/reads site notices; Analytics summarizes platform activity; Email Management creates one-time campaigns for opted-in recipients; Popup Campaigns schedules website announcements/ads; Settings controls payment details, authentication, referrals, site footer/developer credit, email/support settings, AI, and appearance; Errors and Audit Logs support diagnostics and accountability. Admin profile is under My Profile.",
    "AI admin capabilities are deliberately narrower than the full admin UI: it can inspect sanitized section summaries and perform only its allowlisted user/wallet, order-cancellation, service/provider, deposit, promo-code, support, email, popup, and supported appearance actions. It cannot delete accounts, change roles, expose payment proofs/UTRs, or read/change provider or payment credentials. Deposit decisions, order cancellations, and paid image generation always require approval. Email campaigns are one-time, not annual recurring automations.",
    `AI assistant is ${settings.ai.enabled ? "enabled" : "disabled"}; configured action policy: ${settings.ai.actionMode}. Respect the current page's section-specific tool allowlist. Inspect live section data before answering operational questions; never make up user, order, deposit, service, provider, campaign, or analytics data.`,
    "For campaign images, reuse an image the admin uploaded in this chat or a matching built-in banner preset. Generate custom artwork only when explicitly requested; it spends Velona credits and requires approval. Scheduled email and popup times use India time (+05:30) and require the relevant start/schedule and expiry details.",
    "Answer in the admin's language and explain how a feature works using this site's actual workflows. If asked who developed the website, use only the configured developer-credit value above; never infer a person or agency from repository history, model/provider branding, or framework names.",
  ].join("\n");
}
