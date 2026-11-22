"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart, Search, Star } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiFetch } from "@/lib/client-api";

type WishlistService = {
  _id: string;
  providerServiceId: string;
  name: string;
  category: string;
  sellingRate: number;
  min: number;
  max: number;
  refill: boolean;
  active: boolean;
};

export default function WishlistPage() {
  const [services, setServices] = useState<WishlistService[]>([]);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/api/wishlist", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "Unable to load your wishlist.");
        if (active) setServices(result.data?.services ?? []);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load your wishlist.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function removeFromWishlist(service: WishlistService) {
    setBusyIds((current) => new Set(current).add(service._id));
    setError("");
    try {
      const response = await apiFetch("/api/wishlist", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "remove", serviceId: service._id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to update your wishlist.");
      setServices((current) => current.filter((item) => item._id !== service._id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update your wishlist.");
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(service._id);
        return next;
      });
    }
  }

  return (
    <AppShell>
      <div className="wishlist-page space-y-6">
        <section
          className="wishlist-hero workspace-hero relative overflow-hidden rounded-[1.75rem] p-6 text-white shadow-xl sm:p-8"
          style={{ background: "linear-gradient(130deg, var(--motion-accent), #0f172a)" }}
        >
          <div className="pointer-events-none absolute -right-10 -top-14 size-56 rounded-full border border-white/15 bg-white/10 shadow-[0_0_0_24px_rgba(255,255,255,0.04),0_0_0_48px_rgba(255,255,255,0.025)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em]">
                <Heart className="size-3.5" /> Your saved services
              </p>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Wishlist</h1>
              <p className="mt-2 text-sm leading-6 text-white/80">
                Keep services close for quick repeat orders. Ordering a saved service never removes it; only its star can.
              </p>
            </div>
            <Link
              href="/dashboard/services"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-white/90"
            >
              Explore services <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</p>}

        <section className="surface-card overflow-hidden rounded-[1.5rem] border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-bold text-neutral-950">Saved for later</h2>
              <p className="mt-1 text-xs text-neutral-500">
                {services.length} {services.length === 1 ? "service" : "services"} saved · stays here until you remove it
              </p>
            </div>
            <span
              className="grid size-10 place-items-center rounded-xl"
              style={{
                backgroundColor: "color-mix(in srgb, var(--motion-accent) 12%, white)",
                color: "var(--motion-accent)",
              }}
            >
              <Star className="size-5" fill="currentColor" />
            </span>
          </div>

          {loading ? (
            <div className="grid min-h-56 place-items-center px-6 py-12 text-sm text-neutral-500">Loading your saved services…</div>
          ) : services.length === 0 ? (
            <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-400"><Heart className="size-6" /></span>
              <h3 className="mt-4 text-sm font-bold text-neutral-900">Your wishlist is ready</h3>
              <p className="mt-1 max-w-sm text-xs leading-5 text-neutral-500">
                Tap the star on any service to keep it here for quick orders later.
              </p>
              <Link href="/dashboard/services" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-teal-800">
                <Search className="size-3.5" /> Browse services
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
              {services.map((service) => (
                <article key={service._id} className="wishlist-service-card surface-card flex min-w-0 flex-col justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-neutral-950">{service.name}</p>
                      <p className="mt-1 truncate text-xs text-neutral-500">{service.category}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${service.name} from wishlist`}
                      title="Remove from wishlist"
                      disabled={busyIds.has(service._id)}
                      onClick={() => void removeFromWishlist(service)}
                      className="grid size-9 shrink-0 place-items-center rounded-xl border border-neutral-200 bg-white text-[color:var(--motion-accent)] transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      <Star className="size-4" fill="currentColor" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-mono font-semibold text-neutral-600">ID {service.providerServiceId}</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-600">Rs.{service.sellingRate} / 1k</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-600">{service.min}–{service.max}</span>
                    {service.refill && <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Refill</span>}
                    {!service.active && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">Currently unavailable</span>}
                  </div>

                  {service.active ? (
                    <Link
                      href={`/dashboard/services?serviceId=${encodeURIComponent(service._id)}`}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:brightness-95"
                      style={{ backgroundColor: "var(--motion-accent)" }}
                    >
                      Create order <ArrowRight className="size-3.5" />
                    </Link>
                  ) : (
                    <p className="rounded-xl bg-neutral-50 px-3 py-2.5 text-center text-xs font-medium text-neutral-500">
                      This service is not currently available.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
