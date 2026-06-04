import { NextRequest, NextResponse } from "next/server";
import { isAllowedOrigin } from "@/lib/request-origin";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("smm_token")?.value;
  const path = request.nextUrl.pathname;
  const mutatingMethod = ["POST", "PATCH", "DELETE", "PUT"].includes(request.method);

  if (path.startsWith("/api") && mutatingMethod && path !== "/api/deposits/webhook") {
    const origin = request.headers.get("origin");
    if (!isAllowedOrigin(request, origin)) {
      return NextResponse.json({ ok: false, message: "Invalid request origin" }, { status: 403 });
    }
  }

  if ((path.startsWith("/dashboard") || path.startsWith("/admin")) && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/:path*"],
};
