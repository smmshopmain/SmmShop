"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clipboard, CreditCard, UploadCloud, WalletCards } from "lucide-react";
import { apiFetch, apiUrl, backendAssetUrl } from "@/lib/client-api";

type PaymentDetails = {
  qrImageUrl: string;
  upiId: string;
  accountNumber: string;
  ifsc: string;
  accountName: string;
  bankName: string;
  instructions: string;
};

export function DepositForm({ payment, minimumWalletAddAmount }: { payment: PaymentDetails; minimumWalletAddAmount: number }) {
  const [paymentDetails, setPaymentDetails] = useState(payment);
  const [minimumAmount, setMinimumAmount] = useState(minimumWalletAddAmount);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning">("warning");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const [selectedProofPreviewUrl, setSelectedProofPreviewUrl] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    let active = true;

    async function refreshPaymentDetails() {
      try {
        const response = await apiFetch("/api/payment-details", { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!active || !response.ok) return;
        if (result.data?.payment) setPaymentDetails(result.data.payment);
        if (typeof result.data?.minimumWalletAddAmount === "number") {
          setMinimumAmount(result.data.minimumWalletAddAmount);
        }
      } catch {
        // Keep server-rendered payment details if refresh fails.
      }
    }

    refreshPaymentDetails();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (selectedProofPreviewUrl) {
        URL.revokeObjectURL(selectedProofPreviewUrl);
      }
    };
  }, [selectedProofPreviewUrl]);

  const hasPaymentDetails = Boolean(
    paymentDetails.qrImageUrl ||
      paymentDetails.upiId ||
      paymentDetails.accountNumber ||
      paymentDetails.ifsc ||
      paymentDetails.accountName ||
      paymentDetails.bankName ||
      paymentDetails.instructions,
  );

  function uploadFile(file: File) {
    return new Promise<{ ok: boolean; response: unknown }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", apiUrl("/api/uploads/deposit-proof"));
      xhr.withCredentials = true;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, response: result });
        } catch (error) {
          reject(error);
        }
      };

      xhr.onerror = () => reject(new Error("Upload failed"));
      const uploadForm = new FormData();
      uploadForm.set("file", file);
      xhr.send(uploadForm);
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    setMessage("");
    let proofUrl = String(form.get("proofUrl") ?? "").trim();
    const proofFile =
      selectedProofFile ??
      (form.get("proofFile") instanceof File ? (form.get("proofFile") as File) : null);
    const amount = Number(form.get("amount"));

    if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
      setLoading(false);
      setMessageTone("warning");
      setMessage("Enter a valid amount.");
      return;
    }

    if (minimumAmount > 0 && amount < minimumAmount) {
      setLoading(false);
      setMessageTone("warning");
      setMessage(`Minimum wallet top-up amount is Rs.${minimumAmount}.`);
      return;
    }

    if (!(proofFile instanceof File && proofFile.size > 0) && !proofUrl) {
      setLoading(false);
      setMessageTone("warning");
      setMessage("Payment screenshot is required.");
      return;
    }

    if (proofFile instanceof File && proofFile.size > 0) {
      try {
        setUploadProgress(0);
        const uploadResult = await uploadFile(proofFile);
        const parsed = uploadResult.response as { ok?: boolean; data?: { url?: string }; message?: string };
        if (!uploadResult.ok || !parsed.data?.url) {
          setLoading(false);
          setUploadProgress(null);
          setMessageTone("warning");
          setMessage(parsed.message ?? "Proof upload failed");
          return;
        }
        proofUrl = parsed.data.url;
      } catch (error) {
        setLoading(false);
        setUploadProgress(null);
        setMessageTone("warning");
        setMessage(error instanceof Error ? error.message : "Proof upload failed");
        return;
      }
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
    setUploadProgress(null);
    setMessageTone(response.ok ? "success" : "warning");
    setMessage(
      response.ok
        ? `Deposit submitted. ID: ${result.data.deposit.depositId}. Verification window: ${result.data.schedule.start} - ${result.data.schedule.end}.`
        : result.message,
    );
    if (response.ok) {
      formRef.current?.reset();
      setSelectedProofFile(null);
      setSelectedProofPreviewUrl(null);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-5 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-800 ring-1 ring-teal-700/10">
          <WalletCards className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-neutral-950">Add funds</h2>
          <p className="mt-1 text-sm leading-6 text-neutral-600">Payment karein, UTR enter karein, proof upload karein. Admin verification ke baad wallet update hoga.</p>
        </div>
      </div>

      <div className="grid gap-2 rounded-md border border-teal-100 bg-teal-50 p-3 text-sm text-teal-950">
        {["Pay using QR/UPI or bank details", "Enter exact amount and UTR/reference number", "Upload payment screenshot for verification"].map((step, index) => (
          <div key={step} className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-white text-xs font-bold text-teal-800">{index + 1}</span>
            <span className="font-medium">{step}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-teal-700" />
          <h3 className="font-semibold text-neutral-950">Payment details</h3>
        </div>
        {hasPaymentDetails ? (
          <>
            {paymentDetails.qrImageUrl && (
              <img
                src={backendAssetUrl(paymentDetails.qrImageUrl)}
                alt="Payment QR"
                className="mx-auto h-56 w-56 rounded-md border border-neutral-200 bg-white object-contain p-2 shadow-sm"
              />
            )}
            <div className="grid gap-2">
              {paymentDetails.upiId && <PaymentRow label="UPI ID" value={paymentDetails.upiId} />}
              {paymentDetails.bankName && <PaymentRow label="Bank" value={paymentDetails.bankName} />}
              {paymentDetails.accountName && <PaymentRow label="Account name" value={paymentDetails.accountName} />}
              {paymentDetails.accountNumber && <PaymentRow label="Account number" value={paymentDetails.accountNumber} />}
              {paymentDetails.ifsc && <PaymentRow label="IFSC" value={paymentDetails.ifsc} />}
            </div>
            {paymentDetails.instructions && <p className="whitespace-pre-line rounded-md border border-neutral-200 bg-white p-3 text-neutral-700">{paymentDetails.instructions}</p>}
            {minimumAmount > 0 && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Minimum wallet top-up amount is Rs.{minimumAmount}. Isse kam amount submit nahi kiya ja sakta.
              </p>
            )}
          </>
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">Payment details are not configured yet. Contact support before submitting a deposit.</p>
        )}
      </div>

      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-neutral-800">
          Amount
          {minimumAmount > 0 && (
            <span className="text-xs font-medium text-neutral-500">Minimum Rs.{minimumAmount} compulsory</span>
          )}
          <input
            name="amount"
            type="number"
            min={minimumAmount > 0 ? minimumAmount : 1}
            step="0.01"
            required
            placeholder={minimumAmount > 0 ? `Enter Rs.${minimumAmount} or more` : "Enter amount in Rs."}
            className="h-11 rounded-md border border-neutral-300 px-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-neutral-800">
          UTR / Reference number
          <input
            name="utr"
            required
            placeholder="Enter UTR after payment"
            className="h-11 rounded-md border border-neutral-300 px-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
          />
        </label>
        <div className="grid gap-2 text-sm font-semibold text-neutral-800">
          <span>Payment screenshot</span>
          <label htmlFor="proofFile" className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-center text-sm text-neutral-600 hover:border-teal-400 hover:bg-teal-50">
            <UploadCloud className="size-6 text-teal-700" />
            <span className="font-medium">Upload screenshot or PDF</span>
            <input
              id="proofFile"
              name="proofFile"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                setSelectedProofFile(file);
                if (file && file.type.startsWith("image/")) {
                  setSelectedProofPreviewUrl(URL.createObjectURL(file));
                } else {
                  setSelectedProofPreviewUrl(null);
                }
              }}
            />
          </label>
          {selectedProofPreviewUrl && (
            <img src={selectedProofPreviewUrl} alt="Selected proof preview" className="h-40 rounded-md border border-neutral-200 object-contain" />
          )}

          {selectedProofFile && (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
              <p className="font-medium">Selected file:</p>
              <p>{selectedProofFile.name}</p>
              <p className="text-xs text-neutral-500">{selectedProofFile.type || "File selected"}</p>
            </div>
          )}
        </div>
        <label className="grid gap-2 text-sm font-semibold text-neutral-800">
          Screenshot URL <span className="text-xs font-medium text-neutral-500">Optional if file uploaded</span>
          <input
            name="proofUrl"
            type="url"
            placeholder="https://..."
            className="h-11 rounded-md border border-neutral-300 px-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
          />
        </label>
      </div>
      {uploadProgress !== null && (
        <div className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
          Uploading proof: {uploadProgress}%
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-2 rounded-full bg-teal-700" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}
      {message && (
        <p
          className={`rounded-md border px-3 py-2 text-sm font-medium ${
            messageTone === "success"
              ? "border-teal-200 bg-teal-50 text-teal-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {messageTone === "success" && <CheckCircle2 className="mr-2 inline size-4" />}
          {message}
        </p>
      )}
      <button disabled={loading || !hasPaymentDetails} className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60">
        {loading ? "Submitting..." : "Submit deposit"}
      </button>
    </form>
  );
}

function PaymentRow({ label, value }: { label: string; value: string }) {
  async function copyValue() {
    await navigator.clipboard?.writeText(value);
  }

  return (
    <div className="grid gap-2 rounded-md border border-neutral-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-neutral-500">{label}</span>
        <button type="button" onClick={copyValue} className="grid size-8 place-items-center rounded-md border border-neutral-200 text-neutral-500 hover:bg-neutral-100" aria-label={`Copy ${label}`}>
          <Clipboard className="size-4" />
        </button>
      </div>
      <span className="break-words font-semibold text-neutral-900">{value}</span>
    </div>
  );
}
