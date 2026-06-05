"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/client-api";

type Step = "request" | "reset" | "done";

export function PasswordResetForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const nextEmail = String(form.get("email") ?? "").trim();
    const response = await apiFetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: nextEmail }),
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.message ?? "Unable to send OTP");
      return;
    }

    setEmail(nextEmail);
    setMessage(result.data?.message ?? "OTP sent. Check your email.");
    setStep("reset");
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const response = await apiFetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        otp: form.get("otp"),
        newPassword: form.get("newPassword"),
      }),
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.message ?? "Unable to reset password");
      return;
    }

    setStep("done");
    setMessage("Password reset successful. You can login now.");
    router.refresh();
  }

  if (step === "done") {
    return (
      <div className="grid gap-4">
        <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">{message}</p>
        <Link
          href="/login"
          className="rounded-md bg-teal-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-teal-800"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {step === "request" ? (
        <form onSubmit={requestOtp} className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              required
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>
          <button
            disabled={loading}
            className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="grid gap-4">
          <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            OTP sent to <span className="font-semibold">{email}</span>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            OTP
            <input
              name="otp"
              inputMode="numeric"
              minLength={6}
              maxLength={6}
              pattern="[0-9]{6}"
              required
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            New password
            <input
              name="newPassword"
              type="password"
              minLength={8}
              required
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>
          <button
            disabled={loading}
            className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {loading ? "Resetting..." : "Reset password"}
          </button>
          <button
            type="button"
            onClick={() => setStep("request")}
            className="text-sm font-semibold text-teal-700"
          >
            Use a different email
          </button>
        </form>
      )}
      {message && <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">{message}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
