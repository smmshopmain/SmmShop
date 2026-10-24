import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/models";

const STATE_COOKIE = "google_oauth_state";

function clearStateCookie(response: NextResponse) {
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google/callback",
    maxAge: 0,
  });
}

function frontendOrigin(request: NextRequest) {
  const configured = process.env.FRONTEND_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || process.env.NODE_ENV !== "production") return url.origin;
    } catch {
      console.error("FRONTEND_URL is invalid for Google sign-in redirects");
    }
  }
  return request.nextUrl.origin;
}

function failureRedirect(request: NextRequest, code: string, mode: "login" | "register") {
  const response = NextResponse.redirect(new URL(`/${mode}?google_error=${code}`, frontendOrigin(request)));
  clearStateCookie(response);
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get("mode") === "register" ? "register" : "login";
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await rateLimit(`google-oauth-start:${ip}`, 15, 10 * 60_000))) {
      return failureRedirect(request, "rate_limited", mode);
    }
    await dbConnect();
    const settings = await getSettings();
    if (!settings.auth.googleEnabled) return failureRedirect(request, "disabled", mode);

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const configuredAppUrl = process.env.APP_BASE_URL?.trim();
    if (!clientId || !clientSecret || !configuredAppUrl) {
      return failureRedirect(request, "not_configured", mode);
    }

    const appUrl = new URL(configuredAppUrl);
    if (appUrl.protocol !== "https:" && process.env.NODE_ENV === "production") {
      return failureRedirect(request, "not_configured", mode);
    }
    const redirectUri = new URL("/api/auth/google/callback", appUrl).toString();
    const state = randomBytes(32).toString("base64url");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    const ref = request.nextUrl.searchParams.get("ref")?.slice(0, 40) || "";
    const next = request.nextUrl.searchParams.get("next") || "";

    const response = NextResponse.redirect(url);
    response.cookies.set(STATE_COOKIE, JSON.stringify({ state, mode, ref, next }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/google/callback",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    console.error("Google sign-in could not start", {
      error: error instanceof Error ? error.message : "Unknown OAuth error",
    });
    const mode = request.nextUrl.searchParams.get("mode") === "register" ? "register" : "login";
    return failureRedirect(request, "unavailable", mode);
  }
}
