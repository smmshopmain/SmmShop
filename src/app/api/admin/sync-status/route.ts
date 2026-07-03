import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { SyncStatus } from "@/models";

export async function GET() {
  try {
    await requireAdmin();
    await dbConnect();
    const statuses = await SyncStatus.find().sort({ updatedAt: -1 }).lean();
    return ok({ statuses });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load sync status", 401);
  }
}
