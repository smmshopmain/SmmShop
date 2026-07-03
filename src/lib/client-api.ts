export function apiUrl(path: string) {
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  const baseUrl = envBase ? envBase.replace(/\/+$/, "") : "";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (typeof window !== "undefined") {
    return cleanPath;
  }

  return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
}

export function backendAssetUrl(value?: string) {
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return value.startsWith("/") ? apiUrl(value) : value;
}

export function isLegacyUploadPath(value?: string) {
  return Boolean(value?.startsWith("/uploads/"));
}

export async function apiFetch(path: string, init?: RequestInit) {
  return fetch(apiUrl(path), {
    ...init,
    credentials: "include",
  });
}

export async function apiJson(path: string, init?: RequestInit) {
  const res = await apiFetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const result = await res.json();

  if (result && result.ok === true && result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    return { ...result, ...result.data };
  }

  return result;
}
