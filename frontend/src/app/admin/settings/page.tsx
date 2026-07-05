"use client";

import { useEffect, useState } from "react";
import { SettingsForm, ActionButton } from "@/components/admin-controls";
import { AdminHeader } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { apiJson } from "@/lib/client-api";

type PlatformSettings = {
  deposits: {
    verificationMode: "manual" | "automatic";
    verificationStartTime: string;
    verificationEndTime: string;
    minimumWalletAddAmount: number;
    payment: {
      qrImageUrl: string;
      upiId: string;
      accountNumber: string;
      ifsc: string;
      accountName: string;
      bankName: string;
      instructions: string;
    };
  };
  provider: { lowBalanceThreshold: number };
  referrals: { enabled: boolean; commissionPercent: number; commissionAmount: number };
};

const DEFAULT_SETTINGS: PlatformSettings = {
  deposits: {
    verificationMode: "manual",
    verificationStartTime: "",
    verificationEndTime: "",
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
  referrals: { enabled: true, commissionPercent: 2, commissionAmount: 0 },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let mounted = true;

    apiJson("/api/admin/settings")
      .then((nextSettings) => {
        if (!mounted) return;
        setSettings(nextSettings);
      })
      .catch(() => {
        if (mounted) {
          setSettings(DEFAULT_SETTINGS);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Platform controls"
        title="Platform settings"
        description="Deposit verification, payment details, referral commission, and provider balance alerts."
      />
      <div className="mb-4 px-4 lg:px-0">
        <ActionButton label="Backfill referral codes" endpoint="/api/admin/backfill-referrals" method="POST" confirmMessage="Assign referral codes to users missing them?" />
      </div>
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
      />
    </AppShell>
  );
}
