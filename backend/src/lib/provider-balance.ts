import { getProviderBalance, ensureDefaultProviderFromEnv, logProviderEvent } from "@/lib/provider";
import { getSettings, Provider } from "@/models";
import { notifyTelegram } from "@/lib/telegram";

const LOW_BALANCE_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export async function syncProviderBalancesAndNotify() {
  await ensureDefaultProviderFromEnv();
  const settings = await getSettings();
  const alertThreshold = Number(settings.provider.lowBalanceThreshold);
  if (!Number.isFinite(alertThreshold) || alertThreshold < 0) {
    throw new Error("Low provider balance alert threshold is invalid.");
  }
  const providers = await Provider.find({ enabled: true });
  const balances: Array<{
    provider: string;
    balance: number;
    currency?: string;
    lowBalance: boolean;
    alertSent: boolean;
  }> = [];
  let failed = 0;

  for (const provider of providers) {
    try {
      const result = await getProviderBalance(provider);
      const balance = Number(result.balance);
      if (!Number.isFinite(balance) || balance < 0) {
        throw new Error("Provider returned an invalid account balance.");
      }

      provider.balance = balance;
      provider.balanceCurrency = result.currency?.trim() || undefined;
      provider.lastBalanceSyncAt = new Date();
      provider.lastError = undefined;
      const lowBalance = balance <= alertThreshold;
      let alertSent = false;
      if (lowBalance) {
        const lastAlertAt = provider.lowBalanceAlertSentAt?.getTime() ?? 0;
        const thresholdChanged = provider.lowBalanceAlertThreshold !== alertThreshold;
        if (thresholdChanged || Date.now() - lastAlertAt >= LOW_BALANCE_ALERT_COOLDOWN_MS) {
          await provider.save();
          alertSent = await notifyTelegram("Low Provider Balance", [
            `${provider.name}: ${balance}${provider.balanceCurrency ? ` ${provider.balanceCurrency}` : ""}`,
            `Alert threshold: ${alertThreshold}${provider.balanceCurrency ? ` ${provider.balanceCurrency}` : ""}`,
          ]);
          if (alertSent) {
            provider.lowBalanceAlertSentAt = new Date();
            provider.lowBalanceAlertThreshold = alertThreshold;
            await provider.save();
          } else {
            await logProviderEvent({
              provider,
              level: "warning",
              scope: "provider_balance",
              action: "low_balance_alert",
              message: "Low balance detected, but Telegram did not confirm delivery.",
              details: { balance, threshold: alertThreshold, currency: provider.balanceCurrency },
            });
          }
        } else {
          await logProviderEvent({
            provider,
            scope: "provider_balance",
            action: "low_balance_alert",
            message: "Low balance alert suppressed by the six-hour cooldown.",
            details: { balance, threshold: alertThreshold, currency: provider.balanceCurrency },
          });
        }
      } else {
        provider.lowBalanceAlertSentAt = undefined;
        provider.lowBalanceAlertThreshold = undefined;
        await provider.save();
      }
      if (lowBalance && !alertSent && provider.isModified()) await provider.save();
      balances.push({ provider: provider.name, balance, currency: provider.balanceCurrency, lowBalance, alertSent });
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
