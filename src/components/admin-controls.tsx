"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch, backendAssetUrl } from "@/lib/client-api";

export function ActionButton({
  label,
  endpoint,
  method = "PATCH",
  body,
  danger = false,
  confirmMessage,
}: {
  label: string;
  endpoint: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  danger?: boolean;
  confirmMessage?: string;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setLoading(true);
    setMessage("");
    const response = await apiFetch(endpoint, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    const errors = Array.isArray(result.errors) ? result.errors : undefined;
    const successMessage = result.message || "Done";
    const errorMessage = errors?.length ? errors.join("; ") : result.message;
    setMessage(response.ok ? successMessage : errorMessage ?? "Failed");
    if (response.ok && !errors?.length) window.location.reload();
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className={`rounded-md px-3 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60 ${
          danger ? "bg-rose-700 hover:bg-rose-800" : "bg-teal-700 hover:bg-teal-800"
        }`}
      >
        {loading ? "Working..." : label}
      </button>
      {message && <span className="text-xs text-neutral-500">{message}</span>}
    </span>
  );
}

export function SyncStatusPanel() {
  const [statuses, setStatuses] = useState<Array<{
    taskType: string;
    status: string;
    message?: string;
    total?: number;
    processed?: number;
    startedAt?: string;
    finishedAt?: string;
  }>>([]);

  useEffect(() => {
    let active = true;

    async function fetchStatuses() {
      try {
        const response = await apiFetch("/api/admin/sync-status");
        const result = await response.json();
        if (!active || !response.ok) return;
        setStatuses(Array.isArray(result.data?.statuses) ? result.data.statuses : []);
      } catch {
        if (active) setStatuses([]);
      }
    }

    fetchStatuses();
    const interval = setInterval(fetchStatuses, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (statuses.length === 0) {
    return null;
  }

  function formatLabel(taskType: string) {
    switch (taskType) {
      case "service_sync":
        return "Service import";
      case "price_sync":
        return "Price recalculation";
      default:
        return taskType.replace(/_/g, " ");
    }
  }

  return (
    <section className="rounded-md border border-neutral-200 bg-white p-4 text-sm">
      <h2 className="text-lg font-semibold">Sync progress</h2>
      <div className="mt-3 grid gap-4">
        {statuses.map((status) => {
          const total = status.total ?? 0;
          const processed = status.processed ?? 0;
          const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
          return (
            <div key={status.taskType} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-center justify-between gap-4 text-sm font-medium text-neutral-900">
                <span>{formatLabel(status.taskType)}</span>
                <span className="rounded-full bg-white px-2 py-1 text-xs text-neutral-600">{status.status}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200">
                <div className="h-2 rounded-full bg-teal-700" style={{ width: `${percent}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                <span>{status.message ?? `${processed}/${total} completed`}</span>
                {total > 0 && <span>{percent}%</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function DepositRejectForm({ depositId }: { depositId: string }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!window.confirm("Reject this deposit?")) return;
    setLoading(true);
    setMessage("");
    const response = await apiFetch("/api/admin/deposits", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: depositId,
        action: "reject",
        rejectionReason: form.get("rejectionReason"),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "Rejected" : result.message ?? "Unable to reject");
    if (response.ok) window.location.reload();
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <input
        name="rejectionReason"
        placeholder="Reject reason"
        className="w-full rounded-md border border-neutral-300 px-2 py-2 text-xs"
      />
      <button disabled={loading} className="rounded-md bg-rose-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
        {loading ? "Rejecting..." : "Reject"}
      </button>
      {message && <span className="text-xs text-neutral-500">{message}</span>}
    </form>
  );
}

export function WalletAdjustForm({ userId }: { userId: string }) {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await apiFetch("/api/admin/wallet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId,
        action: form.get("action"),
        amount: Number(form.get("amount")),
        note: form.get("note"),
      }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Wallet updated." : result.message);
    if (response.ok) window.location.reload();
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-md bg-neutral-50 p-3 text-xs sm:grid-cols-[110px_110px_1fr_auto]">
      <select name="action" className="rounded-md border border-neutral-300 px-2 py-2">
        <option value="add">Add</option>
        <option value="deduct">Deduct</option>
        <option value="set">Set exact</option>
      </select>
      <input name="amount" type="number" min={0} step="0.01" required className="rounded-md border border-neutral-300 px-2 py-2" />
      <input name="note" placeholder="Audit note" className="rounded-md border border-neutral-300 px-2 py-2" />
      <button className="rounded-md bg-neutral-900 px-3 py-2 font-semibold text-white">Apply</button>
      {message && <p className="sm:col-span-4">{message}</p>}
    </form>
  );
}

export function PromoCodeForm() {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await apiFetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: form.get("code"),
        discountType: form.get("discountType"),
        discountValue: Number(form.get("discountValue")),
        maxUses: form.get("maxUses") ? Number(form.get("maxUses")) : undefined,
        minOrderAmount: Number(form.get("minOrderAmount") || 0),
        active: form.get("active") === "on",
        expiresAt: form.get("expiresAt") || undefined,
      }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Promo code created." : result.message);
    if (response.ok) window.location.reload();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-md border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Create promo code</h2>
      <input name="code" placeholder="Code" required className="rounded-md border border-neutral-300 px-3 py-2" />
      <select name="discountType" className="rounded-md border border-neutral-300 px-3 py-2">
        <option value="percent">Percent</option>
        <option value="fixed">Fixed amount</option>
      </select>
      <input name="discountValue" type="number" min={0.01} step="0.01" placeholder="Discount value" required className="rounded-md border border-neutral-300 px-3 py-2" />
      <input name="minOrderAmount" type="number" min={0} step="0.01" placeholder="Minimum order amount" className="rounded-md border border-neutral-300 px-3 py-2" />
      <input name="maxUses" type="number" min={1} placeholder="Max uses" className="rounded-md border border-neutral-300 px-3 py-2" />
      <label className="grid gap-2 text-sm font-medium">
        Expires at
        <input name="expiresAt" type="datetime-local" className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input name="active" type="checkbox" defaultChecked /> Active
      </label>
      {message && <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm">{message}</p>}
      <button className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white">Save promo</button>
    </form>
  );
}

export function PromoCodeEditForm({
  promo,
}: {
  promo: {
    _id: string;
    code: string;
    discountType: string;
    discountValue: number;
    minOrderAmount: number;
    maxUses?: number;
    active: boolean;
    expiresAt?: string | Date;
  };
}) {
  const [message, setMessage] = useState("");
  const expiresAt = promo.expiresAt ? new Date(promo.expiresAt).toISOString().slice(0, 16) : "";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await apiFetch("/api/admin/promo-codes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: promo._id,
        code: form.get("code"),
        discountType: form.get("discountType"),
        discountValue: Number(form.get("discountValue")),
        maxUses: form.get("maxUses") ? Number(form.get("maxUses")) : undefined,
        minOrderAmount: Number(form.get("minOrderAmount") || 0),
        active: form.get("active") === "on",
        expiresAt: form.get("expiresAt") || null,
      }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Promo updated." : result.message);
    if (response.ok) window.location.reload();
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 rounded-md bg-neutral-50 p-3 text-xs sm:grid-cols-[1fr_120px_120px] md:col-span-4">
      <input name="code" defaultValue={promo.code} required className="rounded-md border border-neutral-300 px-2 py-2" />
      <select name="discountType" defaultValue={promo.discountType} className="rounded-md border border-neutral-300 px-2 py-2">
        <option value="percent">Percent</option>
        <option value="fixed">Fixed amount</option>
      </select>
      <input
        name="discountValue"
        type="number"
        min={0.01}
        step="0.01"
        defaultValue={promo.discountValue}
        required
        className="rounded-md border border-neutral-300 px-2 py-2"
      />
      <input
        name="minOrderAmount"
        type="number"
        min={0}
        step="0.01"
        defaultValue={promo.minOrderAmount}
        className="rounded-md border border-neutral-300 px-2 py-2"
      />
      <input
        name="maxUses"
        type="number"
        min={1}
        defaultValue={promo.maxUses ?? ""}
        placeholder="Max uses"
        className="rounded-md border border-neutral-300 px-2 py-2"
      />
      <input name="expiresAt" type="datetime-local" defaultValue={expiresAt} className="rounded-md border border-neutral-300 px-2 py-2" />
      <label className="flex items-center gap-2 font-medium">
        <input name="active" type="checkbox" defaultChecked={promo.active} /> Active
      </label>
      <button className="rounded-md bg-neutral-900 px-3 py-2 font-semibold text-white sm:col-span-2">Update promo</button>
      {message && <p className="sm:col-span-3">{message}</p>}
    </form>
  );
}

export function AdminResetPasswordForm({ userId }: { userId: string }) {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    const response = await apiFetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: userId, action: "reset_password", password }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Password reset." : result.message);
    if (response.ok) event.currentTarget.reset();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 rounded-md bg-neutral-50 p-3 text-xs">
      <input
        name="password"
        type="password"
        minLength={8}
        placeholder="New password"
        required
        className="min-w-48 rounded-md border border-neutral-300 px-2 py-2"
      />
      <button className="rounded-md bg-neutral-900 px-3 py-2 font-semibold text-white">Reset password</button>
      {message && <span className="text-neutral-500">{message}</span>}
    </form>
  );
}

export type AdminServiceItem = {
  _id: string;
  name: string;
  category: string;
  providerRate: number;
  sellingRate: number;
  min: number;
  max: number;
  active: boolean;
  marginPercent?: number;
  provider?: { name?: string };
};

export function ServiceAdminList({ services }: { services: AdminServiceItem[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMargin, setBulkMargin] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const allSelected = services.length > 0 && selectedIds.length === services.length;

  function toggleService(serviceId: string) {
    setSelectedIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : services.map((service) => service._id));
  }

  async function applyBulkMargin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedIds.length === 0) {
      setMessage("Select at least one service.");
      return;
    }

    setLoading(true);
    setMessage("");
    const response = await apiFetch("/api/admin/services", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ids: selectedIds,
        marginPercent: Number(bulkMargin),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? `Updated ${result.data?.updated ?? selectedIds.length} services.` : result.message ?? "Unable to update services.");
    if (response.ok) window.location.reload();
  }

  return (
    <section className="rounded-md border border-neutral-200 bg-white">
      {services.length > 0 && (
        <div className="border-b border-neutral-200 bg-neutral-50 p-4">
          <form onSubmit={applyBulkMargin} className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex min-h-10 items-center gap-2 font-medium">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="size-4 rounded border-neutral-300" />
              Select all
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Margin %
              <input
                value={bulkMargin}
                onChange={(event) => setBulkMargin(event.target.value)}
                type="number"
                min={0}
                max={500}
                step="0.01"
                required
                className="w-28 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              disabled={loading || selectedIds.length === 0}
              className="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Applying..." : `Apply to selected (${selectedIds.length})`}
            </button>
            {message && <span className="text-xs text-neutral-600">{message}</span>}
          </form>
        </div>
      )}
      {services.map((service) => (
        <div key={service._id} className="grid gap-3 border-b border-neutral-100 p-4 text-sm xl:grid-cols-[32px_1fr_140px_120px_120px_220px]">
          <label className="flex items-start pt-1">
            <input
              type="checkbox"
              checked={selectedIds.includes(service._id)}
              onChange={() => toggleService(service._id)}
              aria-label={`Select ${service.name}`}
              className="size-4 rounded border-neutral-300"
            />
          </label>
          <div>
            <p className="font-medium">{service.name}</p>
            <p className="text-neutral-500">
              {service.category} / {service.provider?.name ?? "Provider"} / {service.min}-{service.max}
            </p>
          </div>
          <span>Cost Rs.{service.providerRate}/1k</span>
          <strong>Sell Rs.{service.sellingRate}/1k</strong>
          <StatusBadge status={service.active ? "Approved" : "Canceled"} />
          <div className="flex flex-wrap items-center gap-2">
            <ServiceMarginForm serviceId={service._id} currentMargin={service.marginPercent} />
            <ActionButton
              label={service.active ? "Disable" : "Enable"}
              endpoint="/api/admin/services"
              body={{ id: service._id, active: !service.active }}
              danger={service.active}
            />
          </div>
        </div>
      ))}
      {services.length === 0 && <p className="p-4 text-sm text-neutral-500">No services imported yet. Run service sync after adding a provider.</p>}
    </section>
  );
}

export function ServiceMarginForm({ serviceId, currentMargin }: { serviceId: string; currentMargin?: number }) {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const margin = form.get("marginPercent");
    const response = await apiFetch("/api/admin/services", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: serviceId,
        marginPercent: margin === "" ? null : Number(margin),
      }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Updated" : result.message);
    if (response.ok) window.location.reload();
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        name="marginPercent"
        type="number"
        min={0}
        max={500}
        step="0.01"
        defaultValue={currentMargin ?? ""}
        placeholder="Margin %"
        className="w-24 rounded-md border border-neutral-300 px-2 py-2 text-xs"
      />
      <button className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">Save</button>
      {message && <span className="text-xs text-neutral-500">{message}</span>}
    </form>
  );
}

export function SettingsForm({
  globalMargin,
  categoryMargins,
  categories,
  startTime,
  endTime,
  mode,
  payment,
  lowBalanceThreshold,
  referralCommissionPercent,
}: {
  globalMargin: number;
  categoryMargins: Record<string, number>;
  categories: string[];
  startTime: string;
  endTime: string;
  mode: string;
  payment: {
    qrImageUrl: string;
    upiId: string;
    accountNumber: string;
    ifsc: string;
    accountName: string;
    bankName: string;
    instructions: string;
  };
  lowBalanceThreshold: number;
  referralCommissionPercent: number;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage("");

    let qrImageUrl = String(form.get("qrImageUrl") ?? "").trim();
    const qrFile = form.get("qrFile");
    if (qrFile instanceof File && qrFile.size > 0) {
      const uploadForm = new FormData();
      uploadForm.set("file", qrFile);
      const uploadResponse = await apiFetch("/api/admin/payment-qr", {
        method: "POST",
        body: uploadForm,
      });
      const uploadResult = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) {
        setLoading(false);
        setMessage(uploadResult.message ?? "QR upload failed.");
        return;
      }
      qrImageUrl = uploadResult.data.url;
    }

    const nextCategoryMargins: Record<string, number> = {};
    for (const category of categories) {
      const value = form.get(`categoryMargin:${category}`);
      if (value !== null && String(value).trim() !== "") {
        nextCategoryMargins[category] = Number(value);
      }
    }
    const requests = [
      apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: "pricing",
          value: {
            globalMarginPercent: Number(form.get("globalMarginPercent")),
            categoryMargins: nextCategoryMargins,
          },
        }),
      }),
      apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: "deposits",
          value: {
            verificationMode: form.get("verificationMode"),
            verificationStartTime: form.get("verificationStartTime"),
            verificationEndTime: form.get("verificationEndTime"),
            payment: {
              qrImageUrl,
              upiId: String(form.get("upiId") ?? "").trim(),
              accountNumber: String(form.get("accountNumber") ?? "").trim(),
              ifsc: String(form.get("ifsc") ?? "").trim().toUpperCase(),
              accountName: String(form.get("accountName") ?? "").trim(),
              bankName: String(form.get("bankName") ?? "").trim(),
              instructions: String(form.get("instructions") ?? "").trim(),
            },
          },
        }),
      }),
      apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: "provider",
          value: { lowBalanceThreshold: Number(form.get("lowBalanceThreshold")) },
        }),
      }),
      apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: "referrals",
          value: { commissionPercent: Number(form.get("referralCommissionPercent")) },
        }),
      }),
    ];
    const responses = await Promise.all(requests);
    setLoading(false);
    setMessage(responses.every((response) => response.ok) ? "Settings saved." : "Unable to save all settings.");
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-md border border-neutral-200 bg-white p-4 md:grid-cols-2">
      <label className="grid gap-2 text-sm font-medium">
        Global margin %
        <input name="globalMarginPercent" type="number" min={0} step="0.01" defaultValue={globalMargin} className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      <div className="grid gap-2 md:col-span-2">
        <h2 className="text-sm font-semibold">Category margins</h2>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <label key={category} className="grid gap-1 text-xs font-medium">
              {category}
              <input
                name={`categoryMargin:${category}`}
                type="number"
                min={0}
                max={500}
                step="0.01"
                defaultValue={categoryMargins[category] ?? ""}
                placeholder={`${globalMargin}% global`}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          ))}
          {categories.length === 0 && <p className="text-sm text-neutral-500">Import services to manage category margins.</p>}
        </div>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Deposit mode
        <select name="verificationMode" defaultValue={mode} className="rounded-md border border-neutral-300 px-3 py-2">
          <option value="manual">Manual</option>
          <option value="automatic">Automatic</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Verification start
        <input name="verificationStartTime" type="time" defaultValue={startTime} className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Verification end
        <input name="verificationEndTime" type="time" defaultValue={endTime} className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      <div id="payment-details" className="scroll-mt-24 grid gap-3 rounded-md bg-neutral-50 p-4 md:col-span-2">
        <h2 className="text-sm font-semibold">Payment details shown to users</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            QR image
            <input name="qrFile" type="file" accept="image/png,image/jpeg,image/webp" className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            QR image URL
            <input name="qrImageUrl" type="text" defaultValue={payment.qrImageUrl} className="rounded-md border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            UPI ID
            <input name="upiId" defaultValue={payment.upiId} className="rounded-md border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Bank name
            <input name="bankName" defaultValue={payment.bankName} className="rounded-md border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Account holder name
            <input name="accountName" defaultValue={payment.accountName} className="rounded-md border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Account number
            <input name="accountNumber" defaultValue={payment.accountNumber} className="rounded-md border border-neutral-300 px-3 py-2" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            IFSC
            <input name="ifsc" defaultValue={payment.ifsc} className="rounded-md border border-neutral-300 px-3 py-2 uppercase" />
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">
            Payment instructions
            <textarea name="instructions" rows={3} defaultValue={payment.instructions} className="rounded-md border border-neutral-300 px-3 py-2" />
          </label>
        </div>
        {payment.qrImageUrl && (
          <div className="grid gap-2 text-sm">
            <span className="font-medium">Current QR</span>
            <img
              src={backendAssetUrl(payment.qrImageUrl)}
              alt="Payment QR"
              className="h-44 w-44 rounded-md border border-neutral-200 bg-white object-contain p-2"
            />
          </div>
        )}
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Low provider balance alert
        <input name="lowBalanceThreshold" type="number" min={0} step="0.01" defaultValue={lowBalanceThreshold} className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Referral commission %
        <input name="referralCommissionPercent" type="number" min={0} max={100} step="0.01" defaultValue={referralCommissionPercent} className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      <div className="flex items-end gap-3">
        <button disabled={loading} className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Saving..." : "Save settings"}
        </button>
        {message && <p className="text-sm text-neutral-600">{message}</p>}
      </div>
    </form>
  );
}

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await apiFetch("/api/tickets", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: ticketId, action: "reply", message: form.get("message") }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Reply sent." : result.message);
    if (response.ok) window.location.reload();
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 rounded-md border border-neutral-200 bg-white p-3">
      <textarea
        name="message"
        rows={2}
        placeholder="Write a reply"
        required
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
      />
      <div className="flex items-center gap-2">
        <button className="rounded-md bg-teal-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-800">Reply</button>
        <ActionButton label="Close" endpoint="/api/tickets" body={{ id: ticketId, action: "close" }} danger />
      </div>
      {message && <p className="text-xs text-neutral-500">{message}</p>}
    </form>
  );
}
