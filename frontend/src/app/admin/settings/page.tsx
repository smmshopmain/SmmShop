"use client";

import { useEffect, useState } from "react";
import { SettingsForm } from "@/components/admin-controls";
import { AdminHeader } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { apiJson } from "@/lib/client-api";

type PlatformSettings = {
  pricing: { globalMarginPercent: number; categoryMargins: Record<string, number>; serviceMargins: Record<string, number> };
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

export default function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    Promise.all([apiJson("/api/admin/settings"), apiJson("/api/admin/services")])
      .then(([nextSettings, servicesData]) => {
        if (!mounted) return;
        setSettings(nextSettings);
        setCategories(servicesData.categories ?? []);
      })
      .catch(() => {
        if (mounted) {
          setSettings(DEFAULT_SETTINGS);
          setCategories([]);
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
