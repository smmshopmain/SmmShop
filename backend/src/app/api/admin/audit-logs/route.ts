import { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api";
import { AuditLog } from "@/models";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action")?.trim();
    const filter = action ? { action: new RegExp(escapeRegExp(action), "i") } : {};
    const logs = await AuditLog.find(filter)
      .populate("actor", "name email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return ok({ logs });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load audit logs", 403);
  }
}
