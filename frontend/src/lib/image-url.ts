export function normalizePublicImageUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }

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
