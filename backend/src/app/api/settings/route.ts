import { fail, ok } from "@/lib/api";
import { getSettings } from "@/models";

export async function GET() {
  try {
    return ok(await getSettings());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load settings", 500);
  }
}
