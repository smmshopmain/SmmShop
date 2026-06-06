"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { apiFetch, backendAssetUrl } from "@/lib/client-api";

type PaymentDetails = {
  qrImageUrl: string;
  upiId: string;
  accountNumber: string;
  ifsc: string;
  accountName: string;
  bankName: string;
  instructions: string;
};

export function DepositForm({ payment }: { payment: PaymentDetails }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const hasPaymentDetails = Boolean(
    payment.qrImageUrl ||
      payment.upiId ||
      payment.accountNumber ||
      payment.ifsc ||
      payment.accountName ||
      payment.bankName ||
      payment.instructions,
  );
  const qrImageUrl = backendAssetUrl(payment.qrImageUrl);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage("");
    let proofUrl = String(form.get("proofUrl") ?? "").trim();
    const proofFile = form.get("proofFile");

    if (!(proofFile instanceof File && proofFile.size > 0) && !proofUrl) {
      setLoading(false);
      setMessage("Payment screenshot is required.");
      return;
    }

    if (proofFile instanceof File && proofFile.size > 0) {
      const uploadForm = new FormData();
      uploadForm.set("file", proofFile);
      const uploadResponse = await apiFetch("/api/uploads/deposit-proof", {
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

    const response = await apiFetch("/api/deposits", {
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
        ? `Deposit submitted. ID: ${result.data.deposit.depositId}. Verification window: ${result.data.schedule.start} - ${result.data.schedule.end}.`
        : result.message,
    );
    if (response.ok) event.currentTarget.reset();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-md border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Manual deposit request</h2>
      <div className="grid gap-3 rounded-md bg-neutral-50 p-3 text-sm">
        <h3 className="font-semibold">Pay using these details</h3>
        {hasPaymentDetails ? (
          <>
            {qrImageUrl && (
              <img
                src={qrImageUrl}
                alt="Payment QR"
                className="h-52 w-52 rounded-md border border-neutral-200 bg-white object-contain p-2"
              />
            )}
            <div className="grid gap-2">
              {payment.upiId && <PaymentRow label="UPI ID" value={payment.upiId} />}
              {payment.bankName && <PaymentRow label="Bank" value={payment.bankName} />}
              {payment.accountName && <PaymentRow label="Account name" value={payment.accountName} />}
              {payment.accountNumber && <PaymentRow label="Account number" value={payment.accountNumber} />}
              {payment.ifsc && <PaymentRow label="IFSC" value={payment.ifsc} />}
            </div>
            {payment.instructions && <p className="whitespace-pre-line rounded-md bg-white p-3 text-neutral-700">{payment.instructions}</p>}
          </>
        ) : (
          <p className="text-neutral-600">Payment details are not configured yet. Contact support before submitting a deposit.</p>
        )}
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Amount
        <input name="amount" type="number" min={1} required className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        UTR
        <input name="utr" required className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Payment screenshot
        <input name="proofFile" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Screenshot URL
        <input name="proofUrl" type="url" className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      {message && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>}
      <button disabled={loading} className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {loading ? "Submitting..." : "Submit deposit"}
      </button>
    </form>
  );
}

function PaymentRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md bg-white p-3">
      <span className="text-xs font-semibold uppercase text-neutral-500">{label}</span>
      <span className="break-words font-medium text-neutral-900">{value}</span>
    </div>
  );
}
