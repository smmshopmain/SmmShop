import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword, setSessionCookieOnResponse } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createUniqueReferralCode } from "@/lib/referral-code";
import { recordLoginSession } from "@/lib/login-session";
import { notifyTelegram } from "@/lib/telegram";
import { sendWelcomeEmail } from "@/lib/welcome-email";
import { getSettings, Referral, User } from "@/models";

const STATE_COOKIE = "google_oauth_state";

type OAuthContext = {
  state: string;
  mode: "login" | "register";
  ref: string;
  next: string;
};

function getOAuthContext(value: string | undefined): OAuthContext | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<OAuthContext>;
    if (
      typeof parsed.state !== "string" ||
      (parsed.mode !== "login" && parsed.mode !== "register") ||
      typeof parsed.ref !== "string" ||
      typeof parsed.next !== "string"
    ) {
      return null;
    }
    return parsed as OAuthContext;
  } catch {
    return null;
  }
}

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

function redirectError(request: NextRequest, code: string, context?: OAuthContext | null) {
  const mode = context?.mode === "register" ? "register" : "login";
  const response = NextResponse.redirect(new URL(`/${mode}?google_error=${code}`, frontendOrigin(request)));
  clearStateCookie(response);
  return response;
}

function stateMatches(expected: OAuthContext | null, actual: string | null) {
  if (!expected || !actual) return false;
  const expectedBytes = Buffer.from(expected.state);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

function safeNextPath(value: string, origin: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "";
  try {
    const target = new URL(value, origin);
    return target.origin === origin ? `${target.pathname}${target.search}${target.hash}` : "";
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const context = getOAuthContext(request.cookies.get(STATE_COOKIE)?.value);
  if (!stateMatches(context, state)) {
    return redirectError(request, "state", context);
  }

  if (request.nextUrl.searchParams.get("error")) {
    return redirectError(request, "cancelled", context);
  }
  if (!code) return redirectError(request, "failed", context);

  try {
    await dbConnect();
    const settings = await getSettings();
    if (!settings.auth.googleEnabled) return redirectError(request, "disabled", context);

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const configuredAppUrl = process.env.APP_BASE_URL?.trim();
    if (!clientId || !clientSecret || !configuredAppUrl) {
      return redirectError(request, "not_configured", context);
    }
    const redirectUri = new URL("/api/auth/google/callback", new URL(configuredAppUrl)).toString();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!tokenResponse.ok) {
      console.error("Google OAuth token exchange failed", { status: tokenResponse.status });
      return redirectError(request, "failed", context);
    }
    const tokenPayload: unknown = await tokenResponse.json();
    if (!tokenPayload || typeof tokenPayload !== "object" || !("access_token" in tokenPayload)) {
      return redirectError(request, "failed", context);
    }
    const accessToken = tokenPayload.access_token;
    if (typeof accessToken !== "string" || !accessToken) return redirectError(request, "failed", context);

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!profileResponse.ok) {
      console.error("Google OAuth user profile request failed", { status: profileResponse.status });
      return redirectError(request, "failed", context);
    }
    const profile: unknown = await profileResponse.json();
    if (!profile || typeof profile !== "object") return redirectError(request, "failed", context);
    const googleProfile = profile as { email?: unknown; email_verified?: unknown; name?: unknown; sub?: unknown };
    if (
      typeof googleProfile.email !== "string" ||
      googleProfile.email_verified !== true ||
      typeof googleProfile.sub !== "string"
    ) {
      return redirectError(request, "unverified", context);
    }

    const email = googleProfile.email.trim().toLowerCase();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await rateLimit(`google-oauth-login:${ip}:${email}`, 10, 10 * 60_000))) {
      return redirectError(request, "rate_limited", context);
    }

    let user = await User.findOne({ googleSub: googleProfile.sub });
    const emailUser = await User.findOne({ email });
    if (user && emailUser && !user._id.equals(emailUser._id)) {
      return redirectError(request, "account_link_conflict", context);
    }
    if (!user) user = emailUser;

    if (user?.isBanned) {
      return redirectError(request, "account_unavailable", context);
    }

    if (!user) {
      if (context?.mode !== "register") {
        return redirectError(request, "account_not_found", context);
      }

      const referralCodeInput = context?.ref.trim().toUpperCase();
      const referralSystemEnabled = settings.referrals.enabled !== false;
      const referrer = referralSystemEnabled && referralCodeInput
        ? await User.findOne({ referralCode: referralCodeInput })
        : null;
      user = await User.create({
        name: typeof googleProfile.name === "string" ? googleProfile.name.trim().slice(0, 80) || email : email,
        email,
        googleSub: googleProfile.sub,
        passwordHash: await hashPassword(randomBytes(48).toString("base64url")),
        role: "user",
        referralCode: await createUniqueReferralCode(User),
        referredBy: referrer?._id,
      });
      if (referralSystemEnabled && referrer) {
        await Referral.create({ referrer: referrer._id, referredUser: user._id });
      }
      try {
        await sendWelcomeEmail(user, request.nextUrl.origin);
      } catch (error) {
        console.error("Google signup welcome email failed", {
          userId: String(user._id),
          error: error instanceof Error ? error.message : "Unknown email delivery error",
        });
      }
      try {
        await notifyTelegram("New User Registration (Google)", [user.email, `Role: ${user.role}`]);
      } catch (error) {
        console.error("Google registration Telegram notification failed", {
          userId: String(user._id),
          error: error instanceof Error ? error.message : "Unknown notification error",
        });
      }
    }

    if (!user.googleSub) user.googleSub = googleProfile.sub;
    await user.save();
    const sessionId = await recordLoginSession(String(user._id), request);

    const origin = frontendOrigin(request);
    const nextPath = context ? safeNextPath(context.next, origin) : "";
    const defaultPath = user.role === "admin" ? "/admin" : "/dashboard/services";
    const response = NextResponse.redirect(new URL(nextPath || defaultPath, origin));
    await setSessionCookieOnResponse(response, {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      sessionId,
      ...(user.role === "admin" ? { authSource: "database" as const } : {}),
    });
    clearStateCookie(response);
    return response;
  } catch (error) {
    console.error("Google OAuth callback failed", {
      error: error instanceof Error ? error.message : "Unknown OAuth error",
    });
    return redirectError(request, "failed", context);
  }
}
