"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/client-api";

type ApiKeyItem = {
  _id: string;
  name: string;
  prefix: string;
  hasStoredSecret: boolean;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
};

type ApiUsage = {
  usage: { requests: number; failedRequests: number; orders: number };
  protocols?: { restEnabled: boolean; standardEnabled: boolean; requireVersionHeader: boolean };
  pricing?: { discountEnabled: boolean; discountPercent: number; discountSource: "account" | "platform" | "none" };
  security: { allowlistEnforced: boolean; allowedIps: string[] };
  sync: {
    available: boolean;
    minimumIntervalMinutes: number;
    enabled: boolean;
    intervalMinutes: number;
    lastSyncAt?: string | null;
    nextSyncAt?: string | null;
  };
  logs: Array<{ endpoint: string; action?: string; success: boolean; statusCode: number; durationMs: number; createdAt: string }>;
  importedServices: Array<{
    externalId: string;
    status: string;
    service: { name: string; category: string; rate: number } | null;
  }>;
};

export function ResellerApiKeys() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [maxKeys, setMaxKeys] = useState(3);
  const [baseUrl, setBaseUrl] = useState("");
  const [revealedSecret, setRevealedSecret] = useState("");
  const [revealedSecretKeyId, setRevealedSecretKeyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [baseUrlCopyState, setBaseUrlCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [copyingKeyId, setCopyingKeyId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [keysResponse, usageResponse] = await Promise.all([
      apiFetch("/api/account/api-keys", { cache: "no-store" }),
      apiFetch("/api/account/api-usage", { cache: "no-store" }),
    ]);
    const [keysResult, usageResult] = await Promise.all([keysResponse.json(), usageResponse.json()]);
    if (!keysResponse.ok || !keysResult?.ok) throw new Error(keysResult?.message ?? "Unable to load API keys.");
    if (!usageResponse.ok || !usageResult?.ok) throw new Error(usageResult?.message ?? "Unable to load API usage.");
    setKeys(keysResult.data?.keys ?? []);
    setMaxKeys(keysResult.data?.maxKeys ?? 3);
    const apiOriginFromRequests = apiUrl("/api/v1").replace(/\/api\/v1\/?$/, "");
    setBaseUrl(keysResult.data?.baseUrl || apiOriginFromRequests || window.location.origin);
    setUsage(usageResult.data ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => {
      void refresh().catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "Unable to load API keys.");
      });
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function createKey(replaceKeyId?: string, name = "My API key") {
    setBusy(true);
    setMessage("");
    setRevealedSecret("");
    setRevealedSecretKeyId(null);
    try {
      const response = await apiFetch("/api/account/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, ...(replaceKeyId ? { replaceKeyId } : {}) }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? "Unable to create API key.");
      setRevealedSecret(result.data.secret);
      setRevealedSecretKeyId(result.data.key?._id ?? null);
      setCopyState("idle");
      setMessage(replaceKeyId
        ? "API key regenerated. Your ready-to-use API setup is below."
        : "API key created. Your ready-to-use API setup is below.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create API key.");
    } finally {
      setBusy(false);
    }
  }

  async function copyExistingKey(id: string) {
    setCopyingKeyId(id);
    setMessage("");
    let secret = "";
    try {
      const response = await apiFetch(`/api/account/api-keys/${encodeURIComponent(id)}/secret`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? "Unable to retrieve API key.");
      secret = result.data.secret;
      setRevealedSecret(secret);
      setRevealedSecretKeyId(id);
      setCopyState("idle");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to retrieve API key.");
      setCopyingKeyId(null);
      return;
    }

    try {
      await navigator.clipboard.writeText(secret);
    } catch {
      setMessage("Clipboard access failed. Select the key shown above and copy it manually.");
      setCopyingKeyId(null);
      return;
    }
    setCopiedKeyId(id);
    setMessage("API key copied to clipboard. Keep it private.");
    setCopyingKeyId(null);
  }

  async function copyRevealedKey() {
    if (!revealedSecret) return;
    try {
      await navigator.clipboard.writeText(revealedSecret);
      setCopiedKeyId(revealedSecretKeyId ?? "new");
      setMessage("API key copied to clipboard. Keep it private.");
    } catch {
      setMessage("Clipboard access failed. Select the key above and copy it manually.");
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this API key immediately? Existing requests using it will stop working.")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/account/api-keys", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? "Unable to revoke API key.");
      setMessage("API key revoked.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to revoke API key.");
    } finally {
      setBusy(false);
    }
  }

  async function synchronizeServices() {
    setBusy(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/account/api-usage", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? "Unable to synchronize services.");
      setMessage(`Service sync complete: ${result.data.active} active, ${result.data.unavailable} unavailable.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to synchronize services.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAutoSync(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/account/api-usage", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: form.get("enabled") === "on",
          intervalMinutes: Number(form.get("intervalMinutes")),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? "Unable to update automatic sync.");
      setMessage("Automatic sync settings saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update automatic sync.");
    } finally {
      setBusy(false);
    }
  }

  const activeCount = keys.filter((key) => !key.revokedAt).length;
  const pricing = usage?.pricing;
  const discountPercent = pricing?.discountPercent ?? 0;
  const estimatedSaving = (1000 * discountPercent / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const apiBase = `${baseUrl || "YOUR_API_BASE_URL"}/api/v1`;
  const apiKeyForExamples = revealedSecret || "YOUR_API_KEY";
  const restVersionHeader = usage?.protocols?.requireVersionHeader
    ? ' --header "X-API-Version: 1"'
    : "";
  const apiReference = [
    `API base URL: ${baseUrl || "YOUR_API_BASE_URL"}`,
    `API key: ${apiKeyForExamples}`,
    "REST authentication: Authorization: Bearer <API_KEY>",
    "Standard SMM authentication: key=<API_KEY> in the POST body",
    "",
    "REST v1 endpoints:",
    "GET    /api/v1/services",
    "GET    /api/v1/services/{serviceId}",
    "GET    /api/v1/categories",
    "GET    /api/v1/balance",
    "GET    /api/v1/account",
    "GET    /api/v1/usage",
    "GET    /api/v1/orders?limit=50",
    "GET    /api/v1/orders/{orderId}",
    "POST   /api/v1/services/import",
    "POST   /api/v1/services/sync",
    "POST   /api/v1/orders",
    "POST   /api/v1/orders/status",
    "Standard SMM: POST /api/v1/standard (services, balance, add, status, multi_status, refill, refill_status, cancel)",
    "",
    usage?.protocols?.restEnabled === false
      ? "REST v1 is currently disabled by the administrator."
      : [
          "REST v1 examples (run from your private server):",
          `curl --request GET "${apiBase}/services" --header "Authorization: Bearer ${apiKeyForExamples}"${restVersionHeader}`,
          `curl --request GET "${apiBase}/balance" --header "Authorization: Bearer ${apiKeyForExamples}"${restVersionHeader}`,
          `curl --request POST "${apiBase}/orders" --header "Authorization: Bearer ${apiKeyForExamples}"${restVersionHeader} --header "Idempotency-Key: UNIQUE_VALUE_FOR_THIS_ORDER" --header "Content-Type: application/json" --data '{"serviceId":"SERVICE_ID_FROM_SERVICES","link":"https://example.com/post","quantity":100}'`,
          `curl --request GET "${apiBase}/orders/ORDER_ID_FROM_RESPONSE" --header "Authorization: Bearer ${apiKeyForExamples}"${restVersionHeader}`,
        ].join("\n"),
    "",
    usage?.protocols?.standardEnabled === false
      ? "Standard SMM API is currently disabled by the administrator."
      : [
          "Standard SMM examples:",
          `curl --request POST "${apiBase}/standard" --header "Content-Type: application/x-www-form-urlencoded" --data-urlencode "key=${apiKeyForExamples}" --data-urlencode "action=services"`,
          `curl --request POST "${apiBase}/standard" --header "Content-Type: application/x-www-form-urlencoded" --data-urlencode "key=${apiKeyForExamples}" --data-urlencode "action=balance"`,
          `curl --request POST "${apiBase}/standard" --header "Content-Type: application/x-www-form-urlencoded" --header "Idempotency-Key: UNIQUE_VALUE_FOR_THIS_ORDER" --data-urlencode "key=${apiKeyForExamples}" --data-urlencode "action=add" --data-urlencode "service=SERVICE_ID_FROM_SERVICES" --data-urlencode "link=https://example.com/post" --data-urlencode "quantity=100"`,
          `curl --request POST "${apiBase}/standard" --header "Content-Type: application/x-www-form-urlencoded" --data-urlencode "key=${apiKeyForExamples}" --data-urlencode "action=status" --data-urlencode "order=ORDER_ID_FROM_RESPONSE"`,
        ].join("\n"),
    "",
    "Use a fresh Idempotency-Key for each new order. Reuse it only to retry the same order request.",
  ].join("\n");

  async function copyApiReference() {
    try {
      await navigator.clipboard.writeText(apiReference);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  async function copyApiBaseUrl() {
    try {
      await navigator.clipboard.writeText(baseUrl);
      setBaseUrlCopyState("copied");
    } catch {
      setBaseUrlCopyState("error");
    }
  }

  return (
    <div className="grid gap-5">
      <section className="surface-card rounded-2xl border border-neutral-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-950">API keys</h2>
            <p className="mt-1 text-sm text-neutral-600">Active keys: {activeCount} / {maxKeys}. Copy active keys again whenever you need them.</p>
          </div>
          <button type="button" onClick={() => void createKey()} disabled={busy || activeCount >= maxKeys} className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {busy ? "Working..." : "Generate API key"}
          </button>
        </div>
        {message && <p role="status" className="mt-3 text-sm text-neutral-600">{message}</p>}
        <div className="mt-4 divide-y divide-neutral-100">
          {keys.map((key) => (
            <div key={key._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold text-neutral-900">{key.name} <span className="font-mono text-xs text-neutral-500">{key.prefix}••••••</span></p>
                <p className="text-xs text-neutral-500">
                  Created {new Date(key.createdAt).toLocaleString()} · Last used {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"} · {key.revokedAt ? "Revoked" : "Active"}
                </p>
                {!key.revokedAt && !key.hasStoredSecret && (
                  <p className="mt-1 text-xs text-amber-700">Older key: regenerate it once to enable secure copy.</p>
                )}
              </div>
              {!key.revokedAt && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy || copyingKeyId !== null || !key.hasStoredSecret}
                    onClick={() => void copyExistingKey(key._id)}
                    title={key.hasStoredSecret ? "Copy this API key" : "Regenerate this older key once to enable copying"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {copiedKeyId === key._id ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
                    {copyingKeyId === key._id ? "Loading..." : copiedKeyId === key._id ? "Copied" : "Copy key"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => void createKey(key._id, key.name)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Regenerate</button>
                  <button type="button" disabled={busy} onClick={() => void revoke(key._id)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">Revoke</button>
                </div>
              )}
            </div>
          ))}
          {keys.length === 0 && <p className="py-4 text-sm text-neutral-500">No API keys have been created.</p>}
        </div>
      </section>

      <section className="surface-card rounded-2xl border border-neutral-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-neutral-950">API setup details</h2>
            <p className="mt-1 text-sm text-neutral-600">Your API key, base URL, endpoints, and copy-ready examples are all together here.</p>
          </div>
          <button
            type="button"
            onClick={() => void copyApiReference()}
            disabled={!baseUrl}
            className="api-code-copy inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copyState === "copied" ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
            {copyState === "copied" ? "Copied" : "Copy complete setup"}
          </button>
        </div>
        {revealedSecret ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-amber-950">Your API key</p>
              <button
                type="button"
                onClick={() => void copyRevealedKey()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-950 transition hover:bg-amber-100"
              >
                {copiedKeyId === (revealedSecretKeyId ?? "new")
                  ? <Check aria-hidden="true" className="size-3.5" />
                  : <Copy aria-hidden="true" className="size-3.5" />}
                {copiedKeyId === (revealedSecretKeyId ?? "new") ? "Copied" : "Copy key"}
              </button>
            </div>
            <code className="mt-2 block break-all rounded-lg bg-white p-3 text-xs text-neutral-900">{revealedSecret}</code>
            <p className="mt-2 text-xs text-amber-900">The key is encrypted when stored. Keep it private and use it only from your server.</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-600">
            {activeCount > 0
              ? <>Use <strong>Copy key</strong> beside an active key above to load it here and include it in the copied setup.</>
              : <>Generate an API key above to show it here and include it in the copied setup.</>}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-neutral-600">API base URL</span>
          <code className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-xs text-neutral-900">{baseUrl || "Loading..."}</code>
          <button
            type="button"
            onClick={() => void copyApiBaseUrl()}
            disabled={!baseUrl}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {baseUrlCopyState === "copied" ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
            {baseUrlCopyState === "copied" ? "Copied" : "Copy URL"}
          </button>
        </div>
        <div className="api-code-example mt-4 overflow-hidden rounded-xl border">
          <div className="api-code-toolbar flex items-center justify-between gap-3 border-b px-4 py-2.5">
            <span className="api-code-title text-[11px] font-bold uppercase tracking-[0.12em]">Connection details and cURL examples</span>
            <span className="api-code-badge rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">REST · Standard SMM</span>
          </div>
          <pre className="overflow-x-auto px-4 py-4 font-mono text-xs leading-6">{apiReference}</pre>
        </div>
        {baseUrlCopyState === "error" && (
          <p role="status" className="mt-2 text-xs text-rose-700">Clipboard access failed. Select the API base URL and copy it manually.</p>
        )}
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
          If a real key is revealed, the copied setup includes it. Keep the copied text private and run requests only from a trusted server—never put the key in browser code or a public repository.
        </p>
        {copyState === "error" && (
          <p role="status" className="mt-2 text-xs text-rose-700">Clipboard access failed. Select the setup above and copy it manually.</p>
        )}
      </section>

      <section className="api-benefits-panel rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="api-code-title text-xs font-bold uppercase tracking-[0.14em]">Live API pricing</p>
            <h2 className="mt-1 text-lg font-bold">Your API benefits</h2>
          </div>
          <span className="api-code-badge rounded-lg px-3 py-1.5 text-sm font-bold">
            {pricing?.discountEnabled ? `${discountPercent}% discount` : "No active discount"}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6">
          {pricing?.discountEnabled
            ? `Your current ${pricing.discountSource === "account" ? "account-specific" : "platform"} discount saves about ₹${estimatedSaving} for every ₹1,000 of listed API service rates.`
            : "API access still lets you discover services, automate orders, and check balances and order status using your website wallet."}
        </p>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <li>• Use one API key for service lookup, order placement, and status checks.</li>
          <li>• API orders are charged from your existing website wallet.</li>
          <li>• Idempotency keys help prevent duplicate orders when retrying requests.</li>
          <li>• The API discount applies to API prices and does not change website-order prices.</li>
        </ul>
        <p className="mt-3 text-xs leading-5 opacity-80">
          Admin pricing changes are picked up automatically (this page refreshes every 30 seconds). Each new API request uses the latest discount; fetch the service list again to see updated rates. Existing orders keep their original price.
        </p>
      </section>

      <section className="surface-card rounded-2xl border border-neutral-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-neutral-950">API usage and imported services</h2>
            <p className="text-sm text-neutral-600">
              {usage?.usage.requests ?? 0} requests · {usage?.usage.failedRequests ?? 0} failed · {usage?.usage.orders ?? 0} API orders
            </p>
          </div>
          <button type="button" onClick={() => void synchronizeServices()} disabled={busy} className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-bold disabled:opacity-50">
            {busy ? "Syncing..." : "Sync imported services"}
          </button>
        </div>
        {usage?.security.allowlistEnforced && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            API calls are restricted to these IP addresses: {usage.security.allowedIps.length ? usage.security.allowedIps.join(", ") : "No address configured; contact support or an administrator."}
          </p>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {usage?.importedServices.map((item) => (
            <div key={item.externalId} className="rounded-xl border border-neutral-200 p-3 text-sm">
              <p className="font-semibold text-neutral-900">{item.service?.name ?? "Unavailable service"}</p>
              <p className="text-xs text-neutral-500">{item.service?.category ?? "Service unavailable"} · ID {item.externalId} · {item.status}</p>
              {item.service && <p className="mt-1 text-xs text-neutral-600">Current API rate: {item.service.rate} / 1000</p>}
            </div>
          ))}
          {(!usage || usage.importedServices.length === 0) && <p className="text-sm text-neutral-500">No services imported yet. Use POST /api/v1/services/import to import services.</p>}
        </div>
        <form key={JSON.stringify(usage?.sync)} onSubmit={saveAutoSync} className="mt-5 flex flex-wrap items-end gap-3 border-t border-neutral-100 pt-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
            <input name="enabled" type="checkbox" defaultChecked={usage?.sync.enabled ?? false} disabled={!usage?.sync.available || busy} className="size-4 accent-teal-700" />
            Automatic service sync
          </label>
          <label className="text-xs font-semibold text-neutral-700">
            Interval (minutes)
            <input name="intervalMinutes" type="number" min={usage?.sync.minimumIntervalMinutes ?? 5} max={10080} defaultValue={usage?.sync.intervalMinutes ?? 60} disabled={!usage?.sync.available || busy} className="ml-2 w-24 rounded-lg border border-neutral-300 px-2 py-1.5" />
          </label>
          <button type="submit" disabled={!usage?.sync.available || busy} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Save sync settings</button>
          <p className="basis-full text-xs text-neutral-500">
            {usage?.sync.available
              ? `Last sync: ${usage.sync.lastSyncAt ? new Date(usage.sync.lastSyncAt).toLocaleString() : "Not run yet"} · Next sync: ${usage.sync.nextSyncAt ? new Date(usage.sync.nextSyncAt).toLocaleString() : "Not scheduled"}`
              : "Automatic sync is currently unavailable."}
          </p>
        </form>
        {Boolean(usage?.logs.length) && (
          <div className="mt-4">
            <h3 className="text-sm font-bold text-neutral-800">Recent API activity</h3>
            <div className="mt-2 divide-y divide-neutral-100">
              {usage?.logs.map((log, index) => (
                <div key={`${log.createdAt}-${index}`} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
                  <span>{log.action ?? log.endpoint} · {log.statusCode} · {log.durationMs} ms</span>
                  <span className={log.success ? "text-teal-700" : "text-rose-700"}>{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
