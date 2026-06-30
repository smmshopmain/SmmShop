import { PricingMarginsForm } from "@/components/admin-controls";
import { AdminHeader } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { Category, getSettings, Service, type PlatformSettings } from "@/models";

export default async function PricingPage() {
  let pricing: PlatformSettings["pricing"] = {
    globalMarginPercent: 20,
    categoryMargins: {},
    serviceMargins: {},
  };
  let categories: string[] = [];

  try {
    await requireAdmin();
    const [settings, syncedCategories] = await Promise.all([
      getSettings(),
      Category.find({ active: true }).sort({ name: 1 }).select("name").lean(),
    ]);
    pricing = settings.pricing;
    categories = [...new Set(syncedCategories.map((category) => category.name))];
    if (categories.length === 0) categories = await Service.distinct("category");
  } catch {
    pricing = { ...pricing };
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Pricing controls"
        title="Margins"
        description="Manage global and category margins separately from general platform settings."
      />
      <PricingMarginsForm
        globalMargin={pricing.globalMarginPercent}
        categoryMargins={pricing.categoryMargins ?? {}}
        categories={categories}
      />
    </AppShell>
  );
}
