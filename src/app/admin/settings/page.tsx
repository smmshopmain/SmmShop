import { SettingsForm } from "@/components/admin-controls";
import { AdminHeader } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { getSettings, type PlatformSettings } from "@/models";

type SettingsPageSettings = Pick<PlatformSettings, "deposits" | "provider" | "referrals">;

export default async function SettingsPage() {
  let settings: SettingsPageSettings = {
    deposits: {
      verificationMode: "manual",
      verificationStartTime: "10:00",
      verificationEndTime: "22:00",
      minimumWalletAddAmount: 0,
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
    referrals: {
      enabled: true,
      commissionPercent: 2,
      commissionAmount: 0,
      minimumReferredWalletAddAmount: 0,
    },
  };

  try {
    await requireAdmin();
    const nextSettings = await getSettings();
    settings = nextSettings;
  } catch {
    settings = { ...settings };
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Platform controls"
        title="Platform settings"
        description="Deposit verification, payment details, referral commission, and provider balance alerts."
      />
      <SettingsForm
        mode={settings.deposits.verificationMode}
        startTime={settings.deposits.verificationStartTime}
        endTime={settings.deposits.verificationEndTime}
        payment={settings.deposits.payment}
        minimumWalletAddAmount={settings.deposits.minimumWalletAddAmount}
        lowBalanceThreshold={settings.provider.lowBalanceThreshold}
        referralEnabled={settings.referrals.enabled}
        referralCommissionPercent={settings.referrals.commissionPercent}
        referralCommissionAmount={settings.referrals.commissionAmount}
        referralMinimumWalletAddAmount={settings.referrals.minimumReferredWalletAddAmount}
      />
    </AppShell>
  );
}
