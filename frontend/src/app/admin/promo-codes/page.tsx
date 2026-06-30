import { AppShell } from "@/components/app-shell";
import { ActionButton, PromoCodeEditForm, PromoCodeForm } from "@/components/admin-controls";
import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { serverApiJson } from "@/lib/server-api";
import { Tags } from "lucide-react";

export default async function PromoCodesPage() {
  let promoCodes: Array<{
    _id: string;
    code: string;
    discountType: string;
    discountValue: number;
    minOrderAmount: number;
    maxUses?: number;
    usedCount: number;
    active: boolean;
    expiresAt?: Date;
  }> = [];
  let promoDiscounts: Record<string, number> = {};

  try {
    const data = await serverApiJson("/api/admin/promo-codes");
    promoCodes = data.promoCodes ?? [];
    promoDiscounts = data.promoDiscounts ?? {};
  } catch {
    promoCodes = [];
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Growth tools"
        title="Promo codes"
        description="Create, monitor, enable, disable, and edit discounts for customer orders."
      />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <PromoCodeForm />
        <AdminSection title="Active and archived codes" description="Usage, spend and controls" icon={Tags}>
          {promoCodes.map((promo) => (
            <div key={String(promo._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm md:grid-cols-[1fr_130px_110px_100px]">
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
                body={{ id: String(promo._id), active: !promo.active }}
              />
              <PromoCodeEditForm
                promo={{
                  _id: String(promo._id),
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
          {promoCodes.length === 0 && <AdminEmptyState icon={Tags} title="No promo codes yet" description="Create a promo code to start offering order discounts." />}
        </AdminSection>
      </div>
    </AppShell>
  );
}
