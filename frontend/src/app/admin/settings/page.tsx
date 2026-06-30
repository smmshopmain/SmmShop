"use client";

import { useEffect, useState } from "react";
import { SettingsForm } from "@/components/admin-controls";
import { AdminHeader } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { apiJson } from "@/lib/client-api";

type PlatformSettings = {
  deposits: {
    verificationMode: "manual" | "automatic";
    verificationStartTime: string;
    verificationEndTime: string;
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
  referrals: { commissionPercent: number };
};

const DEFAULT_SETTINGS: PlatformSettings = {
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
      <SettingsForm
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
