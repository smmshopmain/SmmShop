import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/models";

export async function GET() {
  try {
    await dbConnect();
    return ok(await getSettings());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load settings", 500);
  }
}
