import { SettingsForm } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/models";

export default async function SettingsPage() {
  let settings = {
    pricing: { globalMarginPercent: 20 },
    deposits: {
      verificationMode: "manual",
      verificationStartTime: "10:00",
      verificationEndTime: "22:00",
    },
    provider: { lowBalanceThreshold: 100 },
  };

  try {
    await requireAdmin();
    settings = await getSettings();
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
        mode={settings.deposits.verificationMode}
        startTime={settings.deposits.verificationStartTime}
        endTime={settings.deposits.verificationEndTime}
        lowBalanceThreshold={settings.provider.lowBalanceThreshold}
      />
    </AppShell>
  );
}
