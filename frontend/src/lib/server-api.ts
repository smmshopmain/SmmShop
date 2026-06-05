import { cookies } from "next/headers";
import { apiUrl } from "@/lib/client-api";

export async function serverApiFetch(path: string, init?: RequestInit) {
  const cookieStore = await cookies();
  const token = cookieStore.get("smm_token")?.value;
  const headers = new Headers(init?.headers);
  if (token) headers.set("cookie", `smm_token=${token}`);

  return fetch(apiUrl(path), {
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
