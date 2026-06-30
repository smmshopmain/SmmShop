import { SettingsForm } from "@/components/admin-controls";
import { AdminHeader } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { Category, getSettings, Service, type PlatformSettings } from "@/models";

export default async function SettingsPage() {
  let settings: PlatformSettings = {
    pricing: { globalMarginPercent: 20, categoryMargins: {}, serviceMargins: {} },
    deposits: {
      verificationMode: "manual",
      verificationStartTime: "10:00",
      verificationEndTime: "22:00",
      payment: {
        qrImageUrl: "",
        upiId: "",
        accountNumber: "",
        ifsc: "",
        accountName: "",
        bankName: "",
        instructions: "",
      },
    },
    provider: { lowBalanceThreshold: 100 },
    referrals: { commissionPercent: 2 },
  };
  let categories: string[] = [];

  try {
    await requireAdmin();
    const [nextSettings, syncedCategories] = await Promise.all([
      getSettings(),
      Category.find({ active: true }).sort({ name: 1 }).select("name").lean(),
    ]);
    settings = nextSettings;
    categories = [...new Set(syncedCategories.map((category) => category.name))];
    if (categories.length === 0) categories = await Service.distinct("category");
  } catch {
    settings = { ...settings };
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Platform controls"
        title="Platform settings"
        description="Pricing margins, deposit verification mode, payment details, referral commission, and provider balance alerts."
      />
      <SettingsForm
        globalMargin={settings.pricing.globalMarginPercent}
        categoryMargins={settings.pricing.categoryMargins ?? {}}
        categories={categories}
        mode={settings.deposits.verificationMode}
        startTime={settings.deposits.verificationStartTime}
        endTime={settings.deposits.verificationEndTime}
        payment={settings.deposits.payment}
        lowBalanceThreshold={settings.provider.lowBalanceThreshold}
        referralCommissionPercent={settings.referrals.commissionPercent}
      />
    </AppShell>
  );
}
