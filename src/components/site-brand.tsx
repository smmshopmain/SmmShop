"use client";

import Image from "next/image";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { apiJson, backendAssetUrl } from "@/lib/client-api";

type SiteBrandSettings = {
  brandName: string;
  brandLogoUrl: string;
  tagline: string;
};

const DEFAULT_SITE_BRAND: SiteBrandSettings = {
  brandName: "SMM Panel",
  brandLogoUrl: "",
  tagline: "Reseller platform",
};

const SiteBrandContext = createContext<SiteBrandSettings>(DEFAULT_SITE_BRAND);

export function SiteBrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState(DEFAULT_SITE_BRAND);
  const previousBrandName = useRef(DEFAULT_SITE_BRAND.brandName);

  useEffect(() => {
    let active = true;
    apiJson("/api/settings")
      .then((result) => {
        const settings = result?.siteFooter;
        if (!active || !settings || typeof settings !== "object") return;
        setBrand({
          brandName: typeof settings.brandName === "string" && settings.brandName.trim()
            ? settings.brandName.trim()
            : DEFAULT_SITE_BRAND.brandName,
          brandLogoUrl: typeof settings.brandLogoUrl === "string" ? settings.brandLogoUrl : "",
          tagline: typeof settings.tagline === "string" && settings.tagline.trim()
            ? settings.tagline.trim()
            : DEFAULT_SITE_BRAND.tagline,
        });
      })
      .catch((error: unknown) => {
        console.error("Unable to load site brand settings; keeping the default brand.", error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const title = document.title;
    const updatedTitle = title.replaceAll(previousBrandName.current, brand.brandName);
    document.title = updatedTitle === title
      ? title.replaceAll("SMM Panel", brand.brandName)
      : updatedTitle;
    previousBrandName.current = brand.brandName;
  }, [brand.brandName]);

  return <SiteBrandContext.Provider value={brand}>{children}</SiteBrandContext.Provider>;
}

export function useSiteBrand() {
  return useContext(SiteBrandContext);
}

export function BrandName({ className = "" }: { className?: string }) {
  const { brandName } = useSiteBrand();
  return <span className={className}>{brandName}</span>;
}

export function BrandTagline({ className = "" }: { className?: string }) {
  const { tagline } = useSiteBrand();
  return <span className={className}>{tagline}</span>;
}

export function BrandMark({
  sizeClass = "size-11",
  className = "",
}: {
  sizeClass?: string;
  className?: string;
}) {
  const { brandName, brandLogoUrl } = useSiteBrand();
  return (
    <span
      role="img"
      aria-label={`${brandName} logo`}
      className={`relative grid ${sizeClass} shrink-0 place-items-center overflow-hidden rounded-full bg-teal-700 text-sm font-extrabold tracking-tight text-white ${className}`}
    >
      {brandLogoUrl ? (
        <Image
          src={backendAssetUrl(brandLogoUrl)}
          alt=""
          aria-hidden="true"
          fill
          sizes="48px"
          unoptimized
          className="rounded-full object-cover"
        />
      ) : (
        brandName.trim().slice(0, 2).toUpperCase() || "SP"
      )}
    </span>
  );
}
