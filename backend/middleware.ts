import { NextRequest, NextResponse } from "next/server";
import { isAllowedOrigin } from "./src/lib/request-origin";

const ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

function setCorsHeaders(response: NextResponse, origin: string | null) {
  if (!origin) return response;
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,X-Requested-With,Accept",
  );
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.set("Vary", "Origin");
  return response;
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const origin = request.headers.get("origin");

  if (path.startsWith("/api")) {
    if (!isAllowedOrigin(request, origin)) {
      return NextResponse.json({ ok: false, message: "Invalid request origin" }, { status: 403 });
    }

    if (request.method === "OPTIONS") {
      const response = NextResponse.json({ ok: true });
      return setCorsHeaders(response, origin);
    }

    const response = NextResponse.next();
    return setCorsHeaders(response, origin);
  }

  if ((path.startsWith("/dashboard") || path.startsWith("/admin")) && !request.cookies.get("smm_token")?.value) {
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
