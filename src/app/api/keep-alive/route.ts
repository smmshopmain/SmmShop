import { ok } from "@/lib/api";

export async function GET() {
  return ok({ awake: true, timestamp: new Date().toISOString() });
}
