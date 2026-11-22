import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { getSettings, Setting } from "@/models";

export async function GET() {
  try {
    await dbConnect();
    const [settings, brandRecord] = await Promise.all([
      getSettings(),
      Setting.findOne({ key: "siteFooter" }).select("value").lean(),
    ]);
    const brandValue = brandRecord?.value && typeof brandRecord.value === "object" && !Array.isArray(brandRecord.value)
      ? brandRecord.value as { brandName?: unknown; brandLogoUrl?: unknown; tagline?: unknown }
      : {};

    return ok({
      referrals: settings.referrals,
      siteFooter: {
        brandName: typeof brandValue.brandName === "string" && brandValue.brandName.trim()
          ? brandValue.brandName.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80)
          : "SMM Panel",
        brandLogoUrl: typeof brandValue.brandLogoUrl === "string"
          && /^\/api\/uploads\/file\/brand-assets\/[a-f\d-]+\.(?:jpg|png|webp)$/i.test(brandValue.brandLogoUrl)
          ? brandValue.brandLogoUrl
          : "",
        tagline: typeof brandValue.tagline === "string" ? brandValue.tagline.trim().slice(0, 160) : "",
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load public settings", 500);
  }
}
