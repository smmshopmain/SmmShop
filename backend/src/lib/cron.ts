import { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { fail } from "@/lib/api";
import { isAdminRole } from "@/lib/roles";

export async function requireCronOrAdmin(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("secret");
  if (secret && provided === secret) return null;

  const user = await currentUser();
  if (isAdminRole(user?.role)) return null;

  return fail("Cron secret or admin session required", 401);
}
