import { buildWelcomeEmail, sendMail } from "@/lib/email";
import { Service } from "@/models";

export function welcomeEmailFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("EMAIL_WORKER_URL is not configured")) {
    return "Welcome email service is not configured: set EMAIL_WORKER_URL in the backend environment.";
  }
  if (message.includes("EMAIL_WORKER_SECRET is not configured")) {
    return "Welcome email service is not configured: set EMAIL_WORKER_SECRET in the backend and matching Vercel environment.";
  }
  if (message.includes("FRONTEND_URL is not configured") || message.includes("Invalid URL")) {
    return "Welcome email link configuration is invalid. Check FRONTEND_URL in the backend environment.";
  }
  if (message.includes("status 401") || message.includes("status 403")) {
    return "Email worker authorization failed. Set the same EMAIL_WORKER_SECRET in the backend and Vercel, then redeploy both.";
  }
  if (message.includes("status 404")) {
    return "Email worker endpoint was not found. Check EMAIL_WORKER_URL and redeploy the frontend email worker.";
  }
  if (message.includes("status 502")) {
    return "The email worker could not send this message. Check the Vercel email-worker logs and SMTP settings.";
  }
  if (message.includes("AbortError") || message.toLowerCase().includes("timeout")) {
    return "The email worker timed out. Check that EMAIL_WORKER_URL is reachable and review the Vercel function logs.";
  }

  return "The email could not be sent. Check the Render backend and Vercel email-worker logs and SMTP settings.";
}

type WelcomeUser = {
  name: string;
  email: string;
  phone?: string;
};

export async function sendWelcomeEmail(user: WelcomeUser, requestOrigin: string) {
  const [activeServiceCount, activeCategories, services] = await Promise.all([
    Service.countDocuments({ active: true }),
    Service.distinct("category", { active: true }),
    Service.find({ active: true })
      .sort({ sellingRate: 1, category: 1, name: 1 })
      .limit(5)
      .select("name category sellingRate")
      .lean(),
  ]);
  const frontendUrl = process.env.FRONTEND_URL?.trim();
  if (!frontendUrl && process.env.NODE_ENV === "production") {
    throw new Error("FRONTEND_URL is not configured");
  }
  const siteUrl = new URL(frontendUrl || requestOrigin);
  if (siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") {
    throw new Error("FRONTEND_URL must use HTTP or HTTPS");
  }

  const welcomeEmail = buildWelcomeEmail({
    name: user.name,
    email: user.email,
    phone: user.phone,
    siteUrl: siteUrl.origin,
    activeServiceCount,
    activeCategoryCount: activeCategories.length,
    services,
  });
  await sendMail({ to: user.email, ...welcomeEmail });
}
