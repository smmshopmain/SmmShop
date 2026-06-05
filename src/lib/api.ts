import { NextRequest, NextResponse } from "next/server";
import { ZodSchema } from "zod";
import { currentUser, requireAdmin, requireUser } from "@/lib/auth";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function parseBody<T>(request: NextRequest, schema: ZodSchema<T>) {
  const body = await request.json().catch(() => null);
  return schema.parse(body);
}

export async function withUser<T>(handler: () => Promise<T>) {
  try {
    await requireUser();
    return ok(await handler());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Request failed", 401);
  }
}

export async function getRequestUser() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export { requireAdmin, requireUser };
