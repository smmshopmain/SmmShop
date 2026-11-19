import { backendAssetUrl } from "@/lib/client-api";
import { normalizePublicImageUrl } from "@/lib/image-url";

export type PopupMediaSource =
  | { type: "image"; src: string }
  | { type: "video"; src: string }
  | { type: "embed"; src: string };

export function resolvePopupMedia(value?: string): PopupMediaSource | null {
  if (!value) return null;
  const src = backendAssetUrl(value);
  if (value.startsWith("/api/uploads/file/popup-images/")) return { type: "image", src };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "youtu.be" ||
    ["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(hostname)
  ) {
    const videoId = hostname === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") ?? /^\/(?:embed|shorts|live)\/([^/]+)/.exec(url.pathname)?.[1];
    if (videoId && /^[\w-]{6,20}$/.test(videoId)) {
      return { type: "embed", src: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0` };
    }
  }

  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(hostname)) {
    const videoId = hostname === "player.vimeo.com"
      ? /^\/video\/(\d+)/.exec(url.pathname)?.[1]
      : /^\/(\d+)/.exec(url.pathname)?.[1];
    if (videoId) {
      const hash = url.searchParams.get("h");
      return { type: "embed", src: `https://player.vimeo.com/video/${videoId}${hash ? `?h=${encodeURIComponent(hash)}` : ""}` };
    }
  }

  if (/\.(?:mp4|webm|ogv|ogg|m4v|mov)$/i.test(url.pathname)) {
    return { type: "video", src: url.toString() };
  }

  return { type: "image", src: normalizePublicImageUrl(url.toString()) };
}
