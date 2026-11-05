import { getProviderBalance, ensureDefaultProviderFromEnv, logProviderEvent } from "@/lib/provider";
import { getSettings, Provider } from "@/models";
import { notifyTelegram } from "@/lib/telegram";

const LOW_BALANCE_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export async function syncProviderBalancesAndNotify() {
  await ensureDefaultProviderFromEnv();
  const settings = await getSettings();
  const providers = await Provider.find({ enabled: true });
  const balances: Array<{ provider: string; balance: number; currency?: string; lowBalance: boolean }> = [];
  let failed = 0;

  for (const provider of providers) {
    try {
      const result = await getProviderBalance(provider);
      const balance = Number(result.balance);
      if (!Number.isFinite(balance) || balance < 0) {
        throw new Error("Provider returned an invalid account balance.");
      }

      provider.balance = balance;
      provider.lastBalanceSyncAt = new Date();
      provider.lastError = undefined;
      const lowBalance = balance <= settings.provider.lowBalanceThreshold;
      if (lowBalance) {
        const lastAlertAt = provider.lowBalanceAlertSentAt?.getTime() ?? 0;
        if (Date.now() - lastAlertAt >= LOW_BALANCE_ALERT_COOLDOWN_MS) {
          const notified = await notifyTelegram("Low Provider Balance", [
            `${provider.name}: ${balance}${result.currency ? ` ${result.currency}` : ""}`,
            `Alert threshold: ${settings.provider.lowBalanceThreshold}`,
          ]);
          if (notified) provider.lowBalanceAlertSentAt = new Date();
        }
      } else {
        provider.lowBalanceAlertSentAt = undefined;
      }
      await provider.save();
      balances.push({ provider: provider.name, balance, currency: result.currency, lowBalance });
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

  return { balances, failed };
}
