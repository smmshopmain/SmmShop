import { isAdminRole } from "@/lib/roles";

import { cookies } from "next/headers";

export async function requireUser() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured. Set it in your environment.");
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("smm_token")?.value;
  const res = await fetch(`${base.replace(/\/+$/, "")}/api/auth/me`, {
    headers: token ? { cookie: `smm_token=${token}` } : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Unauthorized");
  return res.json();
}

export async function requireAdmin() {
  const data = await requireUser();
  const role = data?.auth?.role ?? data?.user?.role ?? data?.data?.role ?? data?.role;
  if (!isAdminRole(role)) throw new Error("Forbidden");
  return data;
}

export async function currentUser() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}
