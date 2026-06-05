import { NextRequest } from "next/server";

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim();
}

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeMultiOrigins(value?: string | null) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter((origin): origin is string => Boolean(origin));
}

export function publicOrigin(request: NextRequest) {
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  if (forwardedHost) {
    return `${forwardedProto || request.nextUrl.protocol.replace(":", "")}://${forwardedHost}`.toLowerCase();
  }

  const host = firstHeaderValue(request.headers.get("host"));
  if (host) {
    return `${request.nextUrl.protocol}//${host}`.toLowerCase();
  }

  return request.nextUrl.origin.toLowerCase();
}

export function allowedRequestOrigins(request: NextRequest) {
  return new Set(
    [
      normalizeOrigin(process.env.APP_BASE_URL),
      normalizeOrigin(process.env.FRONTEND_URL),
      ...normalizeMultiOrigins(process.env.ALLOWED_ORIGINS),
      normalizeOrigin(request.nextUrl.origin),
      normalizeOrigin(publicOrigin(request)),
    ]
      .filter((origin): origin is string => Boolean(origin))
      .map((origin) => origin?.toLowerCase()),
  );
}

export function isAllowedOrigin(request: NextRequest, origin: string | null) {
  if (!origin) return true;
  const normalizedOrigin = normalizeOrigin(origin);
  return Boolean(normalizedOrigin && allowedRequestOrigins(request).has(normalizedOrigin));
}
