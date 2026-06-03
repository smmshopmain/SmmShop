"use client";

import { useState } from "react";

export function DepositForm() {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/deposits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amount: Number(form.get("amount")),
        utr: form.get("utr"),
        proofUrl: form.get("proofUrl") || undefined,
      }),
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? `Deposit submitted. Verification window: ${result.data.schedule.start} - ${result.data.schedule.end}.`
        : result.message,
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-md border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Manual deposit request</h2>
      <label className="grid gap-2 text-sm font-medium">
        Amount
        <input name="amount" type="number" min={1} required className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        UTR
        <input name="utr" required className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Proof URL
        <input name="proofUrl" type="url" className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      {message && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>}
      <button className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white">Submit deposit</button>
    </form>
  );
}
