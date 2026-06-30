"use client";

import { useEffect, useState } from "react";
import { PricingMarginsForm } from "@/components/admin-controls";
import { AdminHeader } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { apiJson } from "@/lib/client-api";

type PricingSettings = {
  globalMarginPercent: number;
  categoryMargins: Record<string, number>;
  serviceMargins: Record<string, number>;
};

const DEFAULT_PRICING: PricingSettings = {
  globalMarginPercent: 20,
  categoryMargins: {},
  serviceMargins: {},
};

export default function PricingPage() {
  const [pricing, setPricing] = useState<PricingSettings>(DEFAULT_PRICING);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    Promise.all([apiJson("/api/admin/settings"), apiJson("/api/admin/services")])
      .then(([settings, servicesData]) => {
        if (!mounted) return;
        setPricing(settings.pricing ?? DEFAULT_PRICING);
        setCategories(servicesData.categories ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setPricing(DEFAULT_PRICING);
        setCategories([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

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
