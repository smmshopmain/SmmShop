import { dbConnect } from "@/lib/db";
import { RateLimit } from "@/models";

const hits = new Map<string, { count: number; resetAt: number }>();

function memoryRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = hits.get(key);
  if (!current || current.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

export async function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  try {
    await dbConnect();
    const now = new Date();
    const resetAt = new Date(Date.now() + windowMs);
    const current = await RateLimit.findOneAndUpdate(
      { key, resetAt: { $gt: now } },
      { $inc: { count: 1 } },
      { new: true },
    );
    if (current) return current.count <= limit;

    await RateLimit.findOneAndUpdate(
      { key },
      { $set: { count: 1, resetAt } },
      { upsert: true, new: true },
    );
    return true;
  } catch {
    return memoryRateLimit(key, limit, windowMs);
  }
}
