"use client";

import { Info, Search, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { IconType } from "react-icons";
import { apiFetch } from "@/lib/client-api";
import {
  FaApple,
  FaBars,
  FaDiscord,
  FaFacebookF,
  FaGlobe,
  FaInstagram,
  FaLinkedinIn,
  FaPinterestP,
  FaPlus,
  FaQuora,
  FaSnapchat,
  FaSoundcloud,
  FaSpotify,
  FaTelegram,
  FaTiktok,
  FaTwitch,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { SiAudiomack, SiKuaishou, SiOdnoklassniki, SiRumble, SiShazam, SiTidal } from "react-icons/si";
import { WARNING_EN, WARNING_HI } from "@/lib/constants";
import { SERVICE_PLATFORMS, type ServicePlatformId } from "@/lib/service-platforms";

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

type PlatformFilterId = "" | ServicePlatformId | "other";

const BRAND_ICONS: Record<ServicePlatformId, { Icon: IconType; color: string }> = {
  telegram: { Icon: FaTelegram, color: "text-sky-500" },
  spotify: { Icon: FaSpotify, color: "text-green-500" },
  instagram: { Icon: FaInstagram, color: "text-pink-500" },
  x: { Icon: FaXTwitter, color: "text-neutral-950" },
  facebook: { Icon: FaFacebookF, color: "text-blue-600" },
  tiktok: { Icon: FaTiktok, color: "text-neutral-950" },
  youtube: { Icon: FaYoutube, color: "text-red-600" },
  website: { Icon: FaGlobe, color: "text-slate-700" },
  snapchat: { Icon: FaSnapchat, color: "text-yellow-400" },
  twitch: { Icon: FaTwitch, color: "text-purple-500" },
  kwai: { Icon: SiKuaishou, color: "text-orange-500" },
  tidal: { Icon: SiTidal, color: "text-neutral-950" },
  soundcloud: { Icon: FaSoundcloud, color: "text-orange-500" },
  shazam: { Icon: SiShazam, color: "text-blue-500" },
  rumble: { Icon: SiRumble, color: "text-green-600" },
  quora: { Icon: FaQuora, color: "text-red-800" },
  pinterest: { Icon: FaPinterestP, color: "text-red-600" },
  odnoklassniki: { Icon: SiOdnoklassniki, color: "text-orange-500" },
  "apple-music": { Icon: FaApple, color: "text-rose-500" },
  audiomack: { Icon: SiAudiomack, color: "text-orange-500" },
  discord: { Icon: FaDiscord, color: "text-indigo-500" },
  linkedin: { Icon: FaLinkedinIn, color: "text-sky-700" },
};

const PLATFORM_OPTIONS: Array<{
  id: PlatformFilterId;
  label: string;
  Icon: IconType;
  color: string;
}> = [
  { id: "", label: "All platforms", Icon: FaBars, color: "text-indigo-900" },
  ...SERVICE_PLATFORMS.map((platform) => ({
    id: platform.id,
    label: platform.label,
    ...BRAND_ICONS[platform.id],
  })),
  { id: "other", label: "Other platforms", Icon: FaPlus, color: "text-slate-700" },
];

export function ServiceBrowser() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [platform, setPlatform] = useState<PlatformFilterId>("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<ServiceItem | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(true);
  const activePlatform = PLATFORM_OPTIONS.find((item) => item.id === platform) ?? PLATFORM_OPTIONS[0];

  useEffect(() => {
    let active = true;
    setServiceLoading(true);
    setMessage("Loading services...");
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (platform) params.set("platform", platform);
    apiFetch(`/api/services?${params}`)
      .then((response) => response.json())
      .then((result) => {
        if (!active) return;
        setServices(result.data?.services ?? []);
        setCategories(result.data?.categories ?? []);
        setMessage("");
      })
      .catch(() => {
        if (!active) return;
        setMessage("Unable to load services. Showing cached results if available.");
      })
      .finally(() => {
        if (active) setServiceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, category, platform]);

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
    const response = await apiFetch("/api/promo-codes/apply", {
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
    const response = await apiFetch("/api/orders", {
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

  function resetSelection() {
    setSelected(null);
    setQuantity(0);
    setPromoPreview(null);
    setMessage("");
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <section className="min-w-0 overflow-hidden rounded-md border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 p-3 sm:p-4">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3 lg:grid-cols-6">
            {PLATFORM_OPTIONS.map((item) => {
              const Icon = item.Icon;
              const active = platform === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  aria-pressed={active}
                  onClick={() => {
                    setPlatform(item.id);
                    setCategory("");
                    resetSelection();
                  }}
                  className={`flex h-11 min-w-0 items-center justify-center rounded-md border text-lg transition sm:h-12 sm:text-xl ${
                    active
                      ? "border-teal-700 bg-teal-50 shadow-sm ring-1 ring-teal-700/10"
                      : "border-neutral-200 bg-white hover:border-teal-300 hover:bg-neutral-50"
                  }`}
                >
                  <Icon className={active ? "text-teal-800" : item.color} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-3 border-b border-neutral-200 p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetSelection();
              }}
              placeholder="Search services"
              className="w-full rounded-md border border-neutral-300 py-2.5 pl-9 pr-3 text-sm"
            />
          </label>
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              resetSelection();
            }}
            className="min-w-0 rounded-md border border-neutral-300 px-3 py-2.5 text-sm"
          >
            <option value="">{platform ? `${activePlatform.label} categories` : "All categories"}</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 p-3 sm:p-4">
          <label className="grid gap-2 text-sm font-semibold text-neutral-800">
            Service
            <select
              value={selected?._id ?? ""}
              onChange={(event) => {
                const service = services.find((item) => item._id === event.target.value) ?? null;
                setSelected(service);
                setQuantity(service?.min ?? 0);
                setPromoPreview(null);
                setMessage("");
              }}
              className="min-w-0 rounded-md border border-neutral-300 px-3 py-2.5 text-sm font-normal"
            >
              <option value="">{services.length ? "Select service" : "No services found"}</option>
              {services.map((service) => (
                <option key={service._id} value={service._id}>
                  {service.name} - Rs.{service.sellingRate}/1k
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-neutral-900">
              <Info className="size-4 text-teal-700" />
              Description
            </div>
            {selected ? (
              <div className="mt-3 grid gap-2 text-neutral-700 sm:grid-cols-2">
                <p>
                  <span className="font-medium text-neutral-950">Category:</span> {selected.category}
                </p>
                <p>
                  <span className="font-medium text-neutral-950">Rate:</span> Rs.{rate}/1000
                </p>
                <p>
                  <span className="font-medium text-neutral-950">Quantity:</span> {selected.min} - {selected.max}
                </p>
                <p>
                  <span className="font-medium text-neutral-950">Refill:</span> {selected.refill ? "Available" : "Not available"}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-neutral-500">
                {platform ? `${activePlatform.label} platform services are ready to choose.` : "Choose a platform or search to find services."}
              </p>
            )}
          </div>

          <div className="max-h-[28rem] divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
            {services.slice(0, 80).map((service) => {
              const active = selected?._id === service._id;
              return (
                <button
                  key={service._id}
                  type="button"
                  onClick={() => {
                    setSelected(service);
                    setQuantity(service.min);
                    setPromoPreview(null);
                    setMessage("");
                  }}
                  className={`grid w-full min-w-0 gap-2 px-3 py-3 text-left transition sm:grid-cols-[minmax(0,1fr)_120px_130px] sm:px-4 ${
                    active ? "bg-teal-50" : "hover:bg-amber-50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{service.name}</span>
                    <span className="block truncate text-xs text-neutral-500">{service.category}</span>
                  </span>
                  <span className="text-sm font-semibold">Rs.{service.sellingRate}/1k</span>
                  <span className="text-xs text-neutral-500">
                    {service.min} - {service.max}
                  </span>
                </button>
              );
            })}
            {services.length === 0 && (
              <p className="p-6 text-sm text-neutral-500">
                {serviceLoading ? "Loading services..." : message || "No services found."}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 sm:p-4 xl:sticky xl:top-20">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-5 text-teal-700" />
          <h2 className="text-lg font-semibold">Place order</h2>
        </div>
        <p className="mt-2 break-words text-sm text-neutral-600">
          {selected ? selected.name : "Select a service from the list to start."}
        </p>
        <form onSubmit={order} className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Link
            <input name="link" type="url" required className="min-w-0 rounded-md border border-neutral-300 px-3 py-2.5" />
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
              className="min-w-0 rounded-md border border-neutral-300 px-3 py-2.5"
            />
          </label>
          <div className="grid gap-2 text-sm font-medium">
            Promo code
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={promoCode}
                onChange={(event) => {
                  setPromoCode(event.target.value);
                  setPromoPreview(null);
                }}
                className="min-w-0 rounded-md border border-neutral-300 px-3 py-2.5"
              />
              <button
                type="button"
                onClick={applyPromo}
                disabled={!selected || loading}
                className="rounded-md border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-60"
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
