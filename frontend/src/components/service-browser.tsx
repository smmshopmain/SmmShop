"use client";

import { BadgeCheck, Filter, Info, Search, ShoppingCart, Sparkles, Star, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { IconType } from "react-icons";
import { apiFetch } from "@/lib/client-api";
import { ServiceDetailsModal, type ServiceDetailsItem } from "@/components/service-details-modal";
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
import { ContentLoading } from "@/components/content-loading";

type ServiceItem = ServiceDetailsItem & {
  _id: string;
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
  const [detailsService, setDetailsService] = useState<ServiceItem | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadedServiceKey, setLoadedServiceKey] = useState<string | null>(null);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [wishlistLoaded, setWishlistLoaded] = useState(false);
  const [wishlistBusyIds, setWishlistBusyIds] = useState<Set<string>>(new Set());
  const [wishlistMessage, setWishlistMessage] = useState("");
  const closeServiceDetails = useCallback(() => setDetailsService(null), []);
  const activePlatform = PLATFORM_OPTIONS.find((item) => item.id === platform) ?? PLATFORM_OPTIONS[0];
  const serviceQueryParams = new URLSearchParams();
  if (query.trim()) serviceQueryParams.set("q", query.trim());
  if (category) serviceQueryParams.set("category", category);
  if (platform) serviceQueryParams.set("platform", platform);
  const serviceQueryKey = serviceQueryParams.toString();
  const serviceLoading = loadedServiceKey !== serviceQueryKey;

  useEffect(() => {
    let active = true;
    apiFetch("/api/wishlist", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "Unable to load your wishlist.");
        if (active) {
          setWishlistIds(new Set((result.data?.services ?? []).map((service: ServiceItem) => service._id)));
          setWishlistLoaded(true);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setWishlistMessage(error instanceof Error ? error.message : "Unable to load your wishlist.");
          setWishlistLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      apiFetch(`/api/services?${serviceQueryKey}`)
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
          if (active) setLoadedServiceKey(serviceQueryKey);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [serviceQueryKey]);

  useEffect(() => {
    const serviceId = new URLSearchParams(window.location.search).get("serviceId");
    if (!serviceId || !/^[a-f\d]{24}$/i.test(serviceId)) return;

    let active = true;
    apiFetch(`/api/services?id=${encodeURIComponent(serviceId)}`)
      .then((response) => response.json())
      .then((result) => {
        if (!active) return;
        const service = result.data?.services?.[0] as ServiceItem | undefined;
        if (!service) {
          setMessage("This service is no longer available.");
          return;
        }
        setServices((current) => current.some((item) => item._id === service._id) ? current : [service, ...current]);
        setSelected(service);
        setQuantity(service.min);
        document.querySelector(".order-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(() => {
        if (active) setMessage("Unable to open the selected service. Please try again from the service catalog.");
      });

    return () => {
      active = false;
    };
  }, []);

  const rate = useMemo(() => selected?.sellingRate.toFixed(2) ?? "0.00", [selected]);
  const estimatedTotal = useMemo(() => {
    if (!selected || !quantity) return "0.00";
    return ((selected.sellingRate * quantity) / 1000).toFixed(2);
  }, [quantity, selected]);
  const estimatedTotalNumber = Number(estimatedTotal);
  const finalTotal = Math.max(0, estimatedTotalNumber - (promoPreview?.discount ?? 0)).toFixed(2);

  async function toggleWishlist(service: ServiceItem) {
    const saved = wishlistIds.has(service._id);
    setWishlistBusyIds((current) => new Set(current).add(service._id));
    setWishlistMessage("");
    try {
      const response = await apiFetch("/api/wishlist", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: saved ? "remove" : "add", serviceId: service._id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to update your wishlist.");
      setWishlistIds((current) => {
        const next = new Set(current);
        if (saved) next.delete(service._id);
        else next.add(service._id);
        return next;
      });
      setWishlistMessage(saved ? "Service removed from your wishlist." : "Service saved to your wishlist.");
    } catch (error) {
      setWishlistMessage(error instanceof Error ? error.message : "Unable to update your wishlist.");
    } finally {
      setWishlistBusyIds((current) => {
        const next = new Set(current);
        next.delete(service._id);
        return next;
      });
    }
  }

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

  function selectService(service: ServiceItem) {
    setSelected(service);
    setQuantity(service.min);
    setPromoPreview(null);
    setMessage("");
  }

  function createOrderFromDetails() {
    if (!detailsService) return;
    selectService(detailsService);
    closeServiceDetails();
    window.requestAnimationFrame(() => {
      document.querySelector(".order-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="service-studio grid min-w-0 items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_390px]">
      <section className="service-catalog min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white shadow-sm">
        <div className="service-catalog-header border-b border-neutral-200 p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800">
                <span className="grid size-7 place-items-center rounded-lg bg-teal-100"><Sparkles className="size-3.5" /></span>
                Service library
              </div>
              <h2 className="mt-3 text-xl font-bold tracking-tight text-neutral-950 sm:text-2xl">Find the right boost</h2>
              <p className="mt-1 text-sm text-neutral-500">Compare options, choose a service, then build your order.</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-600">
              <span className={`size-2 rounded-full ${serviceLoading ? "animate-pulse bg-amber-400" : "workspace-live-dot"}`} />
              {serviceLoading ? "Updating catalog" : `${services.length} services available`}
            </div>
          </div>

          <label className="service-search relative mt-5 block">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              maxLength={100}
              onChange={(event) => {
                setQuery(event.target.value);
                resetSelection();
              }}
              placeholder="Search service name, provider ID, category or keywords..."
              className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50/80 pl-11 pr-4 text-sm shadow-none focus:bg-white"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] font-medium text-neutral-400 sm:block">
              Search catalog
            </span>
          </label>
          {wishlistMessage && (
            <p role="status" className="mt-2 text-xs font-medium text-neutral-600">{wishlistMessage}</p>
          )}

          <div className="mt-5">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Choose a platform</p>
              <span className="text-[11px] text-neutral-400">{activePlatform.label}</span>
            </div>
            <div className="service-platforms flex gap-2 overflow-x-auto pb-1">
              {PLATFORM_OPTIONS.map((item) => {
                const Icon = item.Icon;
                const active = platform === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setPlatform(item.id);
                      setCategory("");
                      resetSelection();
                    }}
                    className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition ${
                      active
                        ? "border-teal-700 bg-teal-700 text-white shadow-md shadow-teal-900/15"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-teal-300 hover:bg-teal-50/50"
                    }`}
                  >
                    <Icon className={`text-sm ${active ? "text-white" : item.color}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="service-filter-row flex flex-wrap items-center gap-3 border-b border-neutral-100 bg-neutral-50/65 px-4 py-3 sm:px-6">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
            <Filter className="size-3.5" /> Refine
          </span>
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              resetSelection();
            }}
            className="h-9 min-w-44 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 shadow-none"
          >
            <option value="">{platform ? `${activePlatform.label} categories` : "All categories"}</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          {category && (
            <button type="button" onClick={() => setCategory("")} className="text-xs font-semibold text-teal-800 hover:underline">
              Clear filters
            </button>
          )}
          <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-neutral-400 sm:inline-flex">
            <BadgeCheck className="size-3.5 text-emerald-600" /> Rates shown per 1,000
          </span>
        </div>

        <div className="service-list-heading hidden grid-cols-[minmax(0,1fr)_110px_90px] gap-3 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400 sm:grid">
          <span>Service details</span><span>Starting at</span><span>Min / max</span>
        </div>
        <div className="service-list max-h-[min(66vh,720px)] divide-y divide-neutral-100 overflow-y-auto">
          {services.slice(0, 80).map((service) => {
            const active = selected?._id === service._id;
            return (
              <div
                key={service._id}
                className={`service-row grid w-full min-w-0 items-center gap-3 px-4 py-4 transition sm:grid-cols-[minmax(0,1fr)_110px_90px] sm:px-6 ${
                  active ? "bg-teal-50/80 ring-1 ring-inset ring-teal-200" : "hover:bg-slate-50"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDetailsService(service)}
                    aria-label={`View details for ${service.name}`}
                    aria-haspopup="dialog"
                    aria-expanded={detailsService?._id === service._id}
                    title="View service details"
                    className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${active ? "bg-teal-700 text-white" : "bg-neutral-100"}`}
                  >
                    <FaBars className={active ? "text-lg text-white" : "text-lg text-indigo-900"} />
                  </button>
                  <button
                    type="button"
                    onClick={() => selectService(service)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold text-neutral-900">{service.name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                        <span className="truncate">{service.category}</span>
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-neutral-600">
                          ID {service.providerServiceId}
                        </span>
                        {service.refill && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Refill</span>}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`${wishlistIds.has(service._id) ? "Remove" : "Add"} ${service.name} ${wishlistIds.has(service._id) ? "from" : "to"} wishlist`}
                    aria-pressed={wishlistIds.has(service._id)}
                    title={wishlistIds.has(service._id) ? "Remove from wishlist" : "Save to wishlist"}
                    disabled={!wishlistLoaded || wishlistBusyIds.has(service._id)}
                    aria-busy={wishlistBusyIds.has(service._id)}
                    onClick={() => void toggleWishlist(service)}
                    className="grid size-9 shrink-0 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-400 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    <Star
                      className="size-4"
                      fill={wishlistIds.has(service._id) ? "currentColor" : "none"}
                      style={wishlistIds.has(service._id) ? { color: "var(--motion-accent)" } : undefined}
                    />
                  </button>
                </span>
                <span className="flex items-center justify-between gap-2 sm:block">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 sm:hidden">Rate</span>
                  <span className="text-xs font-bold text-neutral-900">Rs.{service.sellingRate}<span className="font-medium text-neutral-400"> / 1k</span></span>
                </span>
                <span className="flex items-center justify-between gap-2 sm:block">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 sm:hidden">Quantity</span>
                  <span className="text-xs font-semibold text-neutral-600">{service.min} / {service.max}</span>
                </span>
              </div>
            );
          })}
          {services.length === 0 && (
            <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
              {serviceLoading
                ? <ContentLoading compact label="Loading services..." />
                : <span className="grid size-12 place-items-center rounded-2xl bg-neutral-100 text-neutral-400"><Search className="size-5" /></span>}
              <span className="mt-3 text-sm font-semibold text-neutral-800">{serviceLoading ? "Loading service catalog..." : "No matching services"}</span>
              <span className="mt-1 max-w-sm text-xs leading-5 text-neutral-500">{serviceLoading ? "Fetching the latest options for you." : message || "Try another platform or clear your search and filters."}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 text-[11px] text-neutral-400 sm:px-6">
          <span>Showing {Math.min(services.length, 80)} of {services.length} services</span>
          <span>Catalog updates automatically</span>
        </div>
      </section>

      <aside className="order-builder min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white shadow-lg shadow-slate-900/5 2xl:sticky 2xl:top-24">
        <div className="order-builder-header relative overflow-hidden bg-slate-950 p-5 text-white sm:p-6">
          <div className="pointer-events-none absolute -right-6 -top-10 size-36 rounded-full border border-white/10 bg-teal-400/10 shadow-[0_0_0_24px_rgba(255,255,255,0.025),0_0_0_48px_rgba(255,255,255,0.02)]" />
          <div className="relative flex items-center justify-between gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-teal-400/15 text-teal-200"><ShoppingCart className="size-5" /></span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">Order builder</span>
          </div>
          <h2 className="relative mt-4 text-xl font-bold tracking-tight">Create your order</h2>
          <p className="relative mt-1 text-xs leading-5 text-slate-300">
            {selected ? selected.name : "Choose any service to get started."}
          </p>
        </div>

        <form onSubmit={order} className="grid gap-4 p-4 sm:p-5">
          <label className="grid gap-1.5 text-xs font-bold text-neutral-700">
            Target link
            <input name="link" type="url" required placeholder="https://..." className="h-11 min-w-0 rounded-xl border border-neutral-200 bg-neutral-50/60 px-3 text-sm font-normal shadow-none focus:bg-white" />
          </label>
          <label className="grid gap-1.5 text-xs font-bold text-neutral-700">
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
              placeholder={selected ? `${selected.min} – ${selected.max}` : "Select a service first"}
              className="h-11 min-w-0 rounded-xl border border-neutral-200 bg-neutral-50/60 px-3 text-sm font-normal shadow-none focus:bg-white"
            />
          </label>
          {selected && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Rate / 1k</p>
                <p className="mt-1 text-sm font-bold text-neutral-800">Rs.{rate}</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Delivery range</p>
                <p className="mt-1 text-sm font-bold text-neutral-800">{selected.min}–{selected.max}</p>
              </div>
            </div>
          )}
          <div className="grid gap-1.5 text-xs font-bold text-neutral-700">
            Promo code <span className="text-[10px] font-medium text-neutral-400">Optional discount</span>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                value={promoCode}
                onChange={(event) => {
                  setPromoCode(event.target.value);
                  setPromoPreview(null);
                }}
                placeholder="Enter code"
                className="h-10 min-w-0 rounded-xl border border-neutral-200 bg-neutral-50/60 px-3 text-sm font-normal shadow-none focus:bg-white"
              />
              <button type="button" onClick={applyPromo} disabled={!selected || loading} className="rounded-xl border border-neutral-200 px-3 text-xs font-bold text-teal-800 transition hover:bg-teal-50 disabled:opacity-50">
                Apply
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3">
            <div className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-700" />
              <div className="text-[10px] leading-4 text-amber-900">
                <p className="font-semibold">{WARNING_EN}</p>
                <p className="mt-1 text-amber-800">{WARNING_HI}</p>
              </div>
            </div>
            <label className="mt-2 flex items-start gap-2 text-[11px] font-semibold text-amber-950">
              <input name="warningAccepted" type="checkbox" required className="mt-0.5 size-3.5 accent-amber-700" />
              I understand and accept this notice.
            </label>
          </div>
          <div className="rounded-2xl bg-neutral-50 p-3.5 text-xs">
            <div className="flex justify-between gap-3 text-neutral-500"><span>Subtotal</span><strong className="text-neutral-800">Rs.{estimatedTotal}</strong></div>
            {promoPreview && <div className="mt-2 flex justify-between gap-3 text-emerald-700"><span>Promo · {promoPreview.code}</span><strong>− Rs.{promoPreview.discount.toFixed(2)}</strong></div>}
            <div className="mt-3 flex items-end justify-between gap-3 border-t border-neutral-200 pt-3">
              <span className="font-semibold text-neutral-600">Total</span>
              <strong className="text-xl font-extrabold tracking-tight text-neutral-950">Rs.{finalTotal}</strong>
            </div>
          </div>
          {message && <p role="status" className="rounded-xl bg-neutral-100 px-3 py-2.5 text-xs font-medium text-neutral-700">{message}</p>}
          <button disabled={!selected || loading} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
            <TrendingUp className="size-4" />
            {loading ? "Submitting..." : "Place order"}
          </button>
          <p className="text-center text-[10px] text-neutral-400">Your order will appear in order history as soon as it is placed.</p>
        </form>
      </aside>
      {detailsService && (
        <ServiceDetailsModal
          service={detailsService}
          onClose={closeServiceDetails}
          onCreateOrder={createOrderFromDetails}
        />
      )}
    </div>
  );
}
