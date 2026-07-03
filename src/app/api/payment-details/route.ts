import { fail, ok } from "@/lib/api";
import { getSettings } from "@/models";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSettings();
    return ok({
      payment: settings.deposits.payment,
      minimumWalletAddAmount: settings.deposits.minimumWalletAddAmount,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load payment details", 500);
  }
}
