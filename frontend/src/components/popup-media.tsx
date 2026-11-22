import Image from "next/image";
import { resolvePopupMedia } from "@/lib/popup-media";

type PopupMediaProps = {
  url: string;
  alt: string;
  className?: string;
  sizes?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  loading?: "eager" | "lazy";
};

export function PopupMedia({ url, alt, className, sizes, width, height, fill = false, loading }: PopupMediaProps) {
  const media = resolvePopupMedia(url);
  if (!media) return null;

  if (media.type === "video") {
    return <video src={media.src} controls playsInline preload="metadata" className={className} aria-label={alt} />;
  }
  if (media.type === "embed") {
    return (
      <iframe
        src={media.src}
        title={alt}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className={className}
      />
    );
  }

  return (
    <Image
      src={media.src}
      alt={alt}
      width={fill ? undefined : width ?? 640}
      height={fill ? undefined : height ?? 360}
      fill={fill}
      sizes={sizes}
      unoptimized
      loading={loading}
      className={className}
    />
  );
}

export function ResponsivePopupImage({
  mobileUrl,
  desktopUrl,
  alt,
  className,
  sizes,
}: {
  mobileUrl: string;
  desktopUrl: string;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const mobile = resolvePopupMedia(mobileUrl);
  const desktop = resolvePopupMedia(desktopUrl);
  if (mobile?.type !== "image" || desktop?.type !== "image") return null;

  return (
    <picture className="absolute inset-0 block">
      {mobile.src !== desktop.src && <source media="(max-width: 767px)" srcSet={mobile.src} />}
      <Image
        src={desktop.src}
        alt={alt}
        fill
        sizes={sizes}
        unoptimized
        loading="eager"
        className={className}
      />
    </picture>
  );
}
