"use client";

import { useEffect, useState } from "react";
import { SettingsForm, ActionButton } from "@/components/admin-controls";
import { AdminHeader } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { AnimationControls } from "@/components/animation-controls";
import { apiJson } from "@/lib/client-api";
import {
  DEFAULT_MOTION_SETTINGS,
  type MotionSettings,
} from "@/components/motion-settings-provider";

type PlatformSettings = {
  appearance: MotionSettings;
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
  referrals: {
    enabled: boolean;
    commissionPercent: number;
    commissionAmount: number;
    minimumReferredWalletAddAmount: number;
  };
};

const DEFAULT_SETTINGS: PlatformSettings = {
  appearance: DEFAULT_MOTION_SETTINGS,
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
  referrals: {
    enabled: true,
    commissionPercent: 2,
    commissionAmount: 0,
    minimumReferredWalletAddAmount: 0,
  },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;

    apiJson("/api/admin/settings")
      .then((nextSettings) => {
        if (!mounted) return;
        if (!nextSettings?.appearance || !nextSettings?.deposits) {
          throw new Error(nextSettings?.message ?? "Unable to load administrator settings.");
        }
        setSettings(nextSettings);
        setLoadError("");
      })
      .catch((error: unknown) => {
        if (mounted) {
          setSettings(DEFAULT_SETTINGS);
          setLoadError(error instanceof Error ? error.message : "Unable to load administrator settings.");
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
        description="Website design and animations, deposit verification, payment details, referral commission, and provider balance alerts."
      />
      <div id="animation-settings" className="mb-6 scroll-mt-24">
        {loadError && (
          <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            {loadError}
          </p>
        )}
        <AnimationControls
          key={JSON.stringify(settings.appearance)}
          initialSettings={settings.appearance}
        />
      </div>
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
        referralMinimumWalletAddAmount={settings.referrals.minimumReferredWalletAddAmount}
      />
    </AppShell>
  );
}
