import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { publicOrigin } from "@/lib/request-origin";

export async function POST(request: NextRequest) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/login", publicOrigin(request)), { status: 303 });
}
