"use client";

import Image from "next/image";
import { DEFAULT_SITE_BRAND } from "@/lib/site-brand";
import { useSiteBrand } from "@/components/motion-settings-provider";
import { backendAssetUrl } from "@/lib/client-api";

export function BrandMark({
  sizeClass = "size-11",
  className = "",
  brandName,
  brandLogoUrl,
  imageFit = "cover",
}: {
  sizeClass?: string;
  className?: string;
  brandName?: string;
  brandLogoUrl?: string;
  imageFit?: "cover" | "contain";
}) {
  const siteBrand = useSiteBrand();
  const name = brandName ?? siteBrand.brandName ?? DEFAULT_SITE_BRAND.brandName;
  const logoUrl = brandLogoUrl ?? siteBrand.brandLogoUrl;

  return (
    <span
      role="img"
      aria-label={`${name} logo`}
      className={`brand-mark relative grid ${sizeClass} shrink-0 place-items-center overflow-hidden rounded-full text-sm font-extrabold tracking-tight text-white ${className}`}
    >
      {logoUrl ? (
        <Image
          src={backendAssetUrl(logoUrl)}
          alt=""
          aria-hidden="true"
          fill
          sizes="48px"
          unoptimized
          className={imageFit === "contain" ? "object-contain" : "object-cover"}
        />
      ) : (
        name.trim().slice(0, 2).toUpperCase() || "SP"
      )}
    </span>
  );
}

export function BrandName({ className = "" }: { className?: string }) {
  const { brandName } = useSiteBrand();
  return <span className={className}>{brandName}</span>;
}

export function BrandTagline({ className = "" }: { className?: string }) {
  const { tagline } = useSiteBrand();
  return <span className={className}>{tagline}</span>;
}
