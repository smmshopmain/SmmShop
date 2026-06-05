import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { getSettings, Setting } from "@/models";

const schema = z.object({
  key: z.enum(["pricing", "deposits", "provider", "referrals"]),
  value: z.record(z.string(), z.unknown()),
});

export async function GET() {
  try {
    await requireAdmin();
    return ok(await getSettings());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load settings", 403);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const input = schema.parse(await request.json());
    const existing = await Setting.findOne({ key: input.key }).lean();
    const value =
      existing?.value && typeof existing.value === "object" && !Array.isArray(existing.value)
        ? { ...(existing.value as Record<string, unknown>), ...input.value }
        : input.value;
    const setting = await Setting.findOneAndUpdate(
      { key: input.key },
      { value },
      { upsert: true, new: true },
    );
    return ok({ setting });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save settings");
  }
}
