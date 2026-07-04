import { isAdminRole } from "@/lib/roles";

export async function requireUser() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured. Set it in your environment.");
  }
  const res = await fetch(`${base.replace(/\/+$/, "")}/api/auth/me`, { credentials: "include", cache: "no-store" });
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
