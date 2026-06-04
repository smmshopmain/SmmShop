"use client";

import { useState } from "react";

export function DepositForm() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage("");
    let proofUrl = form.get("proofUrl") || undefined;
    const proofFile = form.get("proofFile");

    if (proofFile instanceof File && proofFile.size > 0) {
      const uploadForm = new FormData();
      uploadForm.set("file", proofFile);
      const uploadResponse = await fetch("/api/uploads/deposit-proof", {
        method: "POST",
        body: uploadForm,
      });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) {
        setLoading(false);
        setMessage(uploadResult.message ?? "Proof upload failed");
        return;
      }
      proofUrl = uploadResult.data.url;
    }

    const response = await fetch("/api/deposits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amount: Number(form.get("amount")),
        utr: form.get("utr"),
        proofUrl,
      }),
    });
    const result = await response.json();
    setLoading(false);
    setMessage(
      response.ok
        ? `Deposit submitted. Verification window: ${result.data.schedule.start} - ${result.data.schedule.end}.`
        : result.message,
    );
    if (response.ok) event.currentTarget.reset();
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
        Proof file
        <input name="proofFile" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Proof URL
        <input name="proofUrl" type="url" className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      {message && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>}
      <button disabled={loading} className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {loading ? "Submitting..." : "Submit deposit"}
      </button>
    </form>
  );
}
