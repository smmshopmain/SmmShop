import { buildWelcomeEmail, sendMail } from "@/lib/email";
import { Service } from "@/models";

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
