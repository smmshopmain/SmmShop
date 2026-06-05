import { NextResponse } from "next/server";

const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3002";

async function forwardLogout(request: Request) {
  const backendUrl = `${apiBase}/api/auth/logout`;
  const cookie = request.headers.get("cookie");

  const backendResponse = await fetch(backendUrl, {
    method: "POST",
    headers: {
      ...(cookie ? { cookie } : {}),
    },
    redirect: "manual",
  });

  const response = NextResponse.redirect(new URL("/login", request.url));
  const setCookie = backendResponse.headers.get("set-cookie");
  if (setCookie) {
    response.headers.set("set-cookie", setCookie);
  }

  return response;
}

export async function GET(request: Request) {
  return forwardLogout(request);
}

export async function POST(request: Request) {
  return forwardLogout(request);
}
