"use client";

import { Search, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { WARNING_EN, WARNING_HI } from "@/lib/constants";

type ServiceItem = {
  _id: string;
  name: string;
  category: string;
  sellingRate: number;
  min: number;
  max: number;
  refill: boolean;
};

type PromoPreview = {
  code: string;
  discount: number;
};

export function ServiceBrowser() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<ServiceItem | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    fetch(`/api/services?${params}`)
      .then((response) => response.json())
      .then((result) => {
        setServices(result.data?.services ?? []);
        setCategories(result.data?.categories ?? []);
      })
      .catch(() => setMessage("Unable to load services"));
  }, [query, category]);

  const rate = useMemo(() => selected?.sellingRate.toFixed(2) ?? "0.00", [selected]);
  const estimatedTotal = useMemo(() => {
    if (!selected || !quantity) return "0.00";
    return ((selected.sellingRate * quantity) / 1000).toFixed(2);
  }, [quantity, selected]);
  const estimatedTotalNumber = Number(estimatedTotal);
  const finalTotal = Math.max(0, estimatedTotalNumber - (promoPreview?.discount ?? 0)).toFixed(2);

  async function applyPromo() {
    if (!promoCode.trim()) {
      setPromoPreview(null);
      setMessage("Enter a promo code first.");
      return;
    }
    if (!selected || !quantity) {
      setPromoPreview(null);
      setMessage("Select a service and quantity before applying promo.");
      return;
    }
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/promo-codes/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: promoCode.trim(), amount: estimatedTotalNumber }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setPromoPreview(null);
      setMessage(result.message ?? "Unable to apply promo");
      return;
    }
    setPromoPreview(result.data);
    setPromoCode(result.data.code);
    setMessage(`Promo applied. Discount Rs.${result.data.discount.toFixed(2)}.`);
  }

  async function order(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceId: selected._id,
        link: form.get("link"),
        quantity: Number(form.get("quantity")),
        promoCode: promoCode.trim() || undefined,
        warningAccepted: form.get("warningAccepted") === "on",
      }),
    });
    const result = await response.json();
    setLoading(false);
    setMessage(response.ok ? "Order placed successfully." : (result.message ?? "Order failed"));
    if (response.ok) {
      setPromoPreview(null);
      setPromoCode("");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-md border border-neutral-200 bg-white">
        <div className="grid gap-3 border-b border-neutral-200 p-4 md:grid-cols-[1fr_240px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search services"
              className="w-full rounded-md border border-neutral-300 py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="divide-y divide-neutral-100">
          {services.map((service) => (
            <button
              key={service._id}
              onClick={() => {
                setSelected(service);
                setQuantity(service.min);
                setPromoPreview(null);
                setMessage("");
              }}
              className="grid w-full gap-2 px-4 py-3 text-left hover:bg-amber-50 md:grid-cols-[1fr_120px_130px]"
            >
              <span>
                <span className="block text-sm font-medium">{service.name}</span>
                <span className="text-xs text-neutral-500">{service.category}</span>
              </span>
              <span className="text-sm font-semibold">Rs.{service.sellingRate}/1k</span>
              <span className="text-xs text-neutral-500">
                {service.min} - {service.max}
              </span>
            </button>
          ))}
          {services.length === 0 && <p className="p-6 text-sm text-neutral-500">No services found.</p>}
        </div>
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-5 text-teal-700" />
          <h2 className="text-lg font-semibold">Place order</h2>
        </div>
        <p className="mt-2 text-sm text-neutral-600">
          {selected ? selected.name : "Select a service from the list to start."}
        </p>
        <form onSubmit={order} className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Link
            <input name="link" type="url" required className="rounded-md border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Quantity
            <input
              name="quantity"
              type="number"
              min={selected?.min ?? 1}
              max={selected?.max ?? 100000}
              value={quantity || ""}
              onChange={(event) => {
                setQuantity(Number(event.target.value));
                setPromoPreview(null);
              }}
              required
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>
          <div className="grid gap-2 text-sm font-medium">
            Promo code
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={promoCode}
                onChange={(event) => {
                  setPromoCode(event.target.value);
                  setPromoPreview(null);
                }}
                className="rounded-md border border-neutral-300 px-3 py-2"
              />
              <button
                type="button"
                onClick={applyPromo}
                disabled={!selected || loading}
                className="rounded-md border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-60"
              >
                Apply
              </button>
            </div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{WARNING_EN}</p>
            <p className="mt-2">{WARNING_HI}</p>
            <label className="mt-3 flex gap-2 font-medium">
              <input name="warningAccepted" type="checkbox" required className="mt-1" /> I accept this warning.
            </label>
          </div>
          <p className="text-sm text-neutral-600">Selected rate: Rs.{rate} per 1000</p>
          <div className="rounded-md bg-neutral-50 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span>Estimated total</span>
              <strong>Rs.{estimatedTotal}</strong>
            </div>
            {promoPreview && (
              <div className="mt-2 flex justify-between gap-3 text-teal-800">
                <span>Promo discount ({promoPreview.code})</span>
                <strong>- Rs.{promoPreview.discount.toFixed(2)}</strong>
              </div>
            )}
            <div className="mt-2 flex justify-between gap-3 border-t border-neutral-200 pt-2">
              <span>Final total</span>
              <strong>Rs.{finalTotal}</strong>
            </div>
          </div>
          {message && <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm">{message}</p>}
          <button
            disabled={!selected || loading}
            className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Submit order"}
          </button>
        </form>
      </section>
    </div>
  );
}
