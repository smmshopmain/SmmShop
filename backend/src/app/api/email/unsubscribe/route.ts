import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { unsubscribeFromMarketing } from "@/lib/email-marketing";

function page(message: string, token?: string) {
  const content = token
    ? `<p>Confirm that you want to stop receiving marketing and announcement emails.</p><form method="post"><input type="hidden" name="token" value="${token}"><button style="padding:12px 18px;background:#087e78;color:#fff;border:0;border-radius:8px;font-weight:700">Unsubscribe</button></form>`
    : `<p>${message}</p>`;
  return new NextResponse(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences</title></head><body style="font:16px Arial,sans-serif;background:#f1f5f9;padding:32px;color:#243b53"><main style="max-width:520px;margin:8vh auto;background:white;padding:28px;border-radius:16px"><h1>Email preferences</h1>${content}</main></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!token || token.length > 200) return page("This unsubscribe link is invalid or expired.");
  return page("", token.replace(/[&<>"']/g, ""));
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const token = String(form.get("token") ?? "");
    if (!token || token.length > 200) return page("This unsubscribe link is invalid or expired.");
    await dbConnect();
    const success = await unsubscribeFromMarketing(token);
    return page(success ? "You have been unsubscribed from marketing emails." : "This unsubscribe link is invalid or expired.");
  } catch (error) {
    console.error("Email unsubscribe failed", error);
    return page("We could not update your email preferences. Please try again.");
  }
}
