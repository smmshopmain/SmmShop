import { SettingsForm } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { getSettings, Service, type PlatformSettings } from "@/models";

export default async function SettingsPage() {
  let settings: PlatformSettings = {
    pricing: { globalMarginPercent: 20, categoryMargins: {}, serviceMargins: {} },
    deposits: {
      verificationMode: "manual",
      verificationStartTime: "10:00",
      verificationEndTime: "22:00",
    },
    provider: { lowBalanceThreshold: 100 },
    referrals: { commissionPercent: 2 },
  };
  let categories: string[] = [];

  try {
    await requireAdmin();
    [settings, categories] = await Promise.all([getSettings(), Service.distinct("category")]);
  } catch {
    settings = { ...settings };
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Platform settings</h1>
        <p className="mt-1 text-sm text-neutral-600">Pricing, deposit verification mode, and provider alerts.</p>
      </div>
      <SettingsForm
        globalMargin={settings.pricing.globalMarginPercent}
        categoryMargins={settings.pricing.categoryMargins ?? {}}
        categories={categories}
        mode={settings.deposits.verificationMode}
        startTime={settings.deposits.verificationStartTime}
        endTime={settings.deposits.verificationEndTime}
        lowBalanceThreshold={settings.provider.lowBalanceThreshold}
        referralCommissionPercent={settings.referrals.commissionPercent}
      />
    </AppShell>
  );
}
