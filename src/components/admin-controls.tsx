"use client";

import { useState } from "react";

export function ActionButton({
  label,
  endpoint,
  method = "PATCH",
  body,
  danger = false,
}: {
  label: string;
  endpoint: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  danger?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setMessage("");
    const response = await fetch(endpoint, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "Done" : result.message ?? "Failed");
    if (response.ok) window.location.reload();
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className={`rounded-md px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 ${
          danger ? "bg-rose-700 hover:bg-rose-800" : "bg-teal-700 hover:bg-teal-800"
        }`}
      >
        {loading ? "Working..." : label}
      </button>
      {message && <span className="text-xs text-neutral-500">{message}</span>}
    </span>
  );
}

export function WalletAdjustForm({ userId }: { userId: string }) {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/wallet", {
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
    const response = await fetch("/api/admin/promo-codes", {
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
    const response = await fetch("/api/admin/promo-codes", {
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
    const response = await fetch("/api/admin/users", {
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

export function ServiceMarginForm({ serviceId, currentMargin }: { serviceId: string; currentMargin?: number }) {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const margin = form.get("marginPercent");
    const response = await fetch("/api/admin/services", {
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
  lowBalanceThreshold,
  referralCommissionPercent,
}: {
  globalMargin: number;
  categoryMargins: Record<string, number>;
  categories: string[];
  startTime: string;
  endTime: string;
  mode: string;
  lowBalanceThreshold: number;
  referralCommissionPercent: number;
}) {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextCategoryMargins: Record<string, number> = {};
    for (const category of categories) {
      const value = form.get(`categoryMargin:${category}`);
      if (value !== null && String(value).trim() !== "") {
        nextCategoryMargins[category] = Number(value);
      }
    }
    const requests = [
      fetch("/api/admin/settings", {
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
      fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: "deposits",
          value: {
            verificationMode: form.get("verificationMode"),
            verificationStartTime: form.get("verificationStartTime"),
            verificationEndTime: form.get("verificationEndTime"),
          },
        }),
      }),
      fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: "provider",
          value: { lowBalanceThreshold: Number(form.get("lowBalanceThreshold")) },
        }),
      }),
      fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: "referrals",
          value: { commissionPercent: Number(form.get("referralCommissionPercent")) },
        }),
      }),
    ];
    const responses = await Promise.all(requests);
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
      <label className="grid gap-2 text-sm font-medium">
        Low provider balance alert
        <input name="lowBalanceThreshold" type="number" min={0} step="0.01" defaultValue={lowBalanceThreshold} className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Referral commission %
        <input name="referralCommissionPercent" type="number" min={0} max={100} step="0.01" defaultValue={referralCommissionPercent} className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      <div className="flex items-end gap-3">
        <button className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white">Save settings</button>
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
    const response = await fetch("/api/tickets", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: ticketId, action: "reply", message: form.get("message") }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Reply sent." : result.message);
    if (response.ok) window.location.reload();
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-2">
      <textarea name="message" rows={2} placeholder="Reply" required className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      <div className="flex items-center gap-2">
        <button className="rounded-md bg-teal-700 px-3 py-2 text-xs font-semibold text-white">Reply</button>
        <ActionButton label="Close" endpoint="/api/tickets" body={{ id: ticketId, action: "close" }} danger />
      </div>
      {message && <p className="text-xs text-neutral-500">{message}</p>}
    </form>
  );
}
