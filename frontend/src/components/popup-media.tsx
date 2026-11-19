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
};

export function PopupMedia({ url, alt, className, sizes, width, height, fill = false }: PopupMediaProps) {
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
      className={className}
    />
  );
}
