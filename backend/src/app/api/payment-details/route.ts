import { fail, ok, requireUser } from "@/lib/api";
import { getSettings } from "@/models";

export async function GET() {
  try {
    await requireUser();
    const settings = await getSettings();
    return ok({ payment: settings.deposits.payment });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load payment details", 401);
  }
}
