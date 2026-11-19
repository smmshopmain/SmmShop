import { cookies } from "next/headers";

export async function serverApiFetch(path: string, init?: RequestInit) {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("smm_token")?.value;
  const headers = new Headers(init?.headers);
  if (token) headers.set("cookie", `smm_token=${token}`);

  return fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function serverApiJson(path: string, init?: RequestInit) {
  const response = await serverApiFetch(path, init);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message ?? "Backend request failed");
  }
  if (result && result.ok === true && result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    return { ...result, ...result.data };
  }
  return result;
}
