import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { dbConnect } from "@/lib/db";
import { ensureDefaultProviderFromEnv, getProviderBalance, logProviderEvent } from "@/lib/provider";
import { getSettings, Provider } from "@/models";
import { notifyTelegram } from "@/lib/telegram";

export async function GET(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  try {
    await dbConnect();
    await ensureDefaultProviderFromEnv();
    const settings = await getSettings();
    const providers = await Provider.find({ enabled: true });
    const balances = [];
    let failed = 0;

    for (const provider of providers) {
      try {
        const result = await getProviderBalance(provider);
        const balance = Number(result.balance ?? 0);
        provider.balance = Number.isFinite(balance) ? balance : 0;
        provider.lastBalanceSyncAt = new Date();
        provider.lastError = undefined;
        await provider.save();
        balances.push({ provider: provider.name, balance: provider.balance, currency: result.currency });

        if (provider.balance <= settings.provider.lowBalanceThreshold) {
          await notifyTelegram("Low Provider Balance", [`${provider.name}: ${provider.balance}`]);
        }
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "Provider balance sync failed";
        provider.lastError = message;
        await provider.save();
        await logProviderEvent({
          provider,
          level: "error",
          scope: "provider_balance",
          action: "balance",
          message,
        });
      }
    }

    await logProviderEvent({
      scope: "provider_balance",
      action: "balance",
      message: `Synced ${balances.length} provider balances`,
      details: { balances, failed },
    });

    return ok({ balances, failed });
  } catch (error) {
    await logProviderEvent({
      level: "error",
      scope: "provider_balance",
      action: "balance",
      message: error instanceof Error ? error.message : "Provider balance sync failed",
    });
    await notifyTelegram("Provider Errors", [error instanceof Error ? error.message : "Unknown error"]);
    return fail(error instanceof Error ? error.message : "Provider balance sync failed");
  }
}
