import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { Provider, ProviderLog, SyncStatus } from "@/models";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    await dbConnect();

    if (new URL(request.url).searchParams.get("activeOnly") === "true") {
      const providerIssues = await Provider.find({
        enabled: true,
        lastError: { $exists: true, $nin: [null, ""] },
      })
        .select("name apiUrl lastError updatedAt")
        .sort({ updatedAt: -1 })
        .lean();

      return ok({ providerIssues });
    }

    const [providerLogs, syncFailures, providerIssues] = await Promise.all([
      ProviderLog.find({ level: "error" })
        .populate("provider", "name")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      SyncStatus.find({ status: "failed" }).sort({ updatedAt: -1 }).limit(50).lean(),
      Provider.find({ lastError: { $exists: true, $nin: [null, ""] } })
        .select("name apiUrl lastError updatedAt")
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean(),
    ]);

    return ok({ providerLogs, syncFailures, providerIssues });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load errors", 403);
  }
}
