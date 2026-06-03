import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { getSettings, Setting } from "@/models";

const schema = z.object({
  key: z.enum(["pricing", "deposits", "provider"]),
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
    const setting = await Setting.findOneAndUpdate(
      { key: input.key },
      { value: input.value },
      { upsert: true, new: true },
    );
    return ok({ setting });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save settings");
  }
}
