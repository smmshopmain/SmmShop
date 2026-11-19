export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isHttpImageUrl(value: string) {
  if (!isHttpUrl(value)) return false;
  const url = new URL(value);
  const videoHosts = new Set([
    "youtu.be",
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
    "vimeo.com",
    "www.vimeo.com",
    "player.vimeo.com",
  ]);
  return !videoHosts.has(url.hostname.toLowerCase()) && !/\.(?:mp4|webm|ogv|ogg|m4v|mov)$/i.test(url.pathname);
}

export function normalizePublicImageUrl(value: string) {
  const url = new URL(value);
  if (url.hostname === "drive.google.com") {
    const fileId = /^\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url.pathname)?.[1] ?? url.searchParams.get("id");
    if (fileId) {
      return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
    }
  }
  if (url.hostname === "dropbox.com" || url.hostname === "www.dropbox.com") {
    url.searchParams.delete("dl");
    url.searchParams.set("raw", "1");
  }
  return url.toString();
}
