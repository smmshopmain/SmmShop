type PricingSettings = {
  globalMarginPercent?: number;
  categoryMargins?: Record<string, number>;
  serviceMargins?: Record<string, number>;
};

export function calculateSellingRate(
  providerRate: number,
  category: string,
  serviceId: string,
  pricing: PricingSettings,
) {
  const margin =
    pricing.serviceMargins?.[serviceId] ??
    pricing.categoryMargins?.[category] ??
    pricing.globalMarginPercent ??
    20;

  return roundMoney(providerRate * (1 + margin / 100));
}

export function calculateOrderPrice(ratePerThousand: number, quantity: number) {
  return roundMoney((ratePerThousand * quantity) / 1000);
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
