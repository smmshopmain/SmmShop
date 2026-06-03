import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { ensureDefaultProviderFromEnv, providerRequest } from "@/lib/provider";
import { getSettings, Provider } from "@/models";
import { notifyTelegram } from "@/lib/telegram";

export async function GET() {
  try {
    await dbConnect();
    await ensureDefaultProviderFromEnv();
    const settings = await getSettings();
    const providers = await Provider.find({ enabled: true });
    const balances = [];

    for (const provider of providers) {
      const result = await providerRequest<{ balance?: string | number; currency?: string }>(provider, {
        action: "balance",
      });
      const balance = Number(result.balance ?? 0);
      provider.balance = balance;
      provider.lastBalanceSyncAt = new Date();
      provider.lastError = undefined;
      await provider.save();
      balances.push({ provider: provider.name, balance, currency: result.currency });

      if (balance <= settings.provider.lowBalanceThreshold) {
        await notifyTelegram("Low Provider Balance", [`${provider.name}: ${balance}`]);
      }
    }

    return ok({ balances });
  } catch (error) {
    await notifyTelegram("Provider Errors", [error instanceof Error ? error.message : "Unknown error"]);
    return fail(error instanceof Error ? error.message : "Provider balance sync failed");
  }
}
