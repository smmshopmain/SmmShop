import { SettingsForm } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { serverApiJson } from "@/lib/server-api";
import type { PlatformSettings } from "@/models";

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
    const [nextSettings, servicesData] = await Promise.all([
      serverApiJson("/api/admin/settings"),
      serverApiJson("/api/admin/services"),
    ]);
    settings = nextSettings;
    categories = servicesData.categories ?? [];
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
        payment={settings.deposits.payment}
        lowBalanceThreshold={settings.provider.lowBalanceThreshold}
        referralCommissionPercent={settings.referrals.commissionPercent}
      />
    </AppShell>
  );
}
