import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { User } from "@/models";

function headerValue(request: NextRequest, names: string[]) {
  for (const name of names) {
    const value = request.headers.get(name)?.trim();
    if (value) return decodeHeader(value).slice(0, 100);
  }
  return "";
}

function decodeHeader(value: string) {
  try {
    return decodeURIComponent(value.replace(/^"|"$/g, ""));
  } catch {
    return value.replace(/^"|"$/g, "");
  }
}

function describeDevice(userAgent: string) {
  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /Firefox\//i.test(userAgent)
      ? "Firefox"
      : /OPR\//i.test(userAgent)
        ? "Opera"
        : /Chrome\//i.test(userAgent)
          ? "Chrome"
          : /Safari\//i.test(userAgent)
            ? "Safari"
            : "Unknown browser";
  const operatingSystem = /Android/i.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(userAgent)
      ? "iOS"
      : /Windows/i.test(userAgent)
        ? "Windows"
        : /Mac OS X|Macintosh/i.test(userAgent)
          ? "macOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "Unknown OS";
  const device = /iPad|Tablet/i.test(userAgent)
    ? "Tablet"
    : /Mobile|Android|iPhone|iPod/i.test(userAgent)
      ? "Mobile"
      : "Desktop";

  return `${device} · ${operatingSystem} · ${browser}`;
}

export async function recordLoginSession(userId: string, request: NextRequest) {
  const sessionId = randomUUID();
  const city = headerValue(request, ["x-vercel-ip-city", "cf-ipcity", "x-appengine-city"]);
  const country = headerValue(request, [
    "x-vercel-ip-country",
    "cf-ipcountry",
    "cloudfront-viewer-country",
    "x-appengine-country",
  ]);
  const location = [city, country].filter(Boolean).join(", ") || "Location unavailable";
  const device = describeDevice(request.headers.get("user-agent") ?? "");
  const loggedInAt = new Date();

  const result = await User.updateOne(
    { _id: userId },
    {
      $set: { activeSessionId: sessionId, lastLoginAt: loggedInAt },
      $push: {
        loginHistory: {
          $each: [{ loggedInAt, device, location }],
          $position: 0,
          $slice: 10,
        },
      },
    },
  );
  if (result.matchedCount !== 1) throw new Error("Unable to create an active login session");

  return sessionId;
}
