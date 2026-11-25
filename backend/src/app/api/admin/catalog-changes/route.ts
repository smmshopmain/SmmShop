import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { CatalogChangeEvent } from "@/models";

const patchSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  markAll: z.boolean().optional(),
}).refine(
  (input) => input.id ? input.markAll === undefined : input.markAll === true,
  "Provide either an event id or markAll: true",
);

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const before = searchParams.get("before");
    const filter: Record<string, unknown> = { readBy: { $ne: auth.id } };
    if (before) {
      if (!/^[a-f\d]{24}$/i.test(before)) return fail("Invalid catalog change cursor");
      filter._id = { $lt: before };
    }

    const [events, unreadCount] = await Promise.all([
      CatalogChangeEvent.find(filter).sort({ _id: -1 }).limit(PAGE_SIZE + 1).lean(),
      CatalogChangeEvent.countDocuments({ readBy: { $ne: auth.id } }),
    ]);
    const hasMore = events.length > PAGE_SIZE;
    if (hasMore) events.pop();
    return ok({ events, unreadCount, hasMore });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load catalog changes", 403);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    const input = patchSchema.parse(await request.json());
    await dbConnect();
    const filter = input.markAll
      ? { readBy: { $ne: auth.id } }
      : { _id: input.id, readBy: { $ne: auth.id } };
    const result = await CatalogChangeEvent.updateMany(filter, { $addToSet: { readBy: auth.id } });
    return ok({ markedRead: result.modifiedCount });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to mark catalog change as read");
  }
}
