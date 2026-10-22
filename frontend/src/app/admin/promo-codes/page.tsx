"use client";

import { useCallback, useEffect, useState } from "react";
import { Tags } from "lucide-react";
import { ActionButton, PromoCodeEditForm, PromoCodeForm } from "@/components/admin-controls";
import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiJson } from "@/lib/client-api";

type PromoCode = {
  _id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxUses?: number;
  usedCount: number;
  active: boolean;
  expiresAt?: Date;
};

async function fetchPromoCodes() {
  const data = await apiJson("/api/admin/promo-codes");
  if (!data?.ok) throw new Error(data?.message ?? "Unable to load promo codes.");
  return {
    promoCodes: Array.isArray(data.promoCodes) ? data.promoCodes as PromoCode[] : [],
    promoDiscounts: (data.promoDiscounts ?? {}) as Record<string, number>,
  };
}

export default function PromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoDiscounts, setPromoDiscounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchPromoCodes()
      .then(({ promoCodes: nextPromoCodes, promoDiscounts: nextPromoDiscounts }) => {
        if (!mounted) return;
        setPromoCodes(nextPromoCodes);
        setPromoDiscounts(nextPromoDiscounts);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setPromoCodes([]);
        setPromoDiscounts({});
        setLoadError(error instanceof Error ? error.message : "Unable to load promo codes.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const refreshPromoCodes = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { promoCodes: nextPromoCodes, promoDiscounts: nextPromoDiscounts } = await fetchPromoCodes();
      setPromoCodes(nextPromoCodes);
      setPromoDiscounts(nextPromoDiscounts);
    } catch (error) {
      setPromoCodes([]);
      setPromoDiscounts({});
      setLoadError(error instanceof Error ? error.message : "Unable to load promo codes.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Growth tools"
        title="Promo codes"
        description="Create, monitor, enable, disable, and edit discounts for customer orders."
      />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <PromoCodeForm onCreated={refreshPromoCodes} />
        <AdminSection title="Active and archived codes" description="Usage, spend and controls" icon={Tags}>
          {loadError && (
            <p role="alert" className="m-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
              Promo codes could not be loaded: {loadError}. Check your admin session and try refreshing this page.
            </p>
          )}
          {loading && <p role="status" className="p-4 text-sm text-neutral-500">Loading promo codes...</p>}
          {!loading && promoCodes.map((promo) => (
            <div key={promo._id} className="grid gap-3 border-b border-neutral-100 p-4 text-sm md:grid-cols-[1fr_130px_110px_100px]">
              <div>
                <p className="font-semibold text-neutral-950">{promo.code}</p>
                <p className="text-neutral-500">
                  {promo.discountValue} {promo.discountType === "percent" ? "%" : "Rs."} off, min Rs.{promo.minOrderAmount}
                </p>
                <p className="text-neutral-500">Total discount: Rs.{promoDiscounts[promo.code] ?? 0}</p>
              </div>
              <span>{promo.usedCount}/{promo.maxUses ?? "unlimited"}</span>
              <StatusBadge status={promo.active ? "Approved" : "Canceled"} />
              <ActionButton
                label={promo.active ? "Disable" : "Enable"}
                endpoint="/api/admin/promo-codes"
                body={{ id: promo._id, active: !promo.active }}
              />
              <PromoCodeEditForm
                promo={{
                  _id: promo._id,
                  code: promo.code,
                  discountType: promo.discountType,
                  discountValue: promo.discountValue,
                  minOrderAmount: promo.minOrderAmount,
                  maxUses: promo.maxUses,
                  active: promo.active,
                  expiresAt: promo.expiresAt,
                }}
              />
            </div>
          ))}
          {!loading && promoCodes.length === 0 && !loadError && (
            <AdminEmptyState icon={Tags} title="No promo codes yet" description="Create a promo code to start offering order discounts." />
          )}
        </AdminSection>
      </div>
    </AppShell>
  );
}
