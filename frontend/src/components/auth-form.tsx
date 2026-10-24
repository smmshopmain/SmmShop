"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/client-api";

type RegistrationPayload = {
  name: string;
  email: string;
  password: string;
  referralCode?: string;
};

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<RegistrationPayload | null>(null);
  const [otp, setOtp] = useState("");
  const [referralEnabled, setReferralEnabled] = useState(true);
  const referralParam = mode === "register" ? (searchParams.get("ref") ?? "") : "";

  useEffect(() => {
    if (mode !== "register") return;
    let mounted = true;
    void apiJson("/api/settings")
      .then((result) => {
        if (!mounted) return;
        const referralSettings = result?.referrals ?? result?.data?.referrals;
        setReferralEnabled(referralSettings?.enabled !== false);
      })
      .catch(() => {
        if (mounted) setReferralEnabled(true);
      });
    return () => {
      mounted = false;
    };
  }, [mode]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const registrationPayload: RegistrationPayload | null = mode === "register"
      ? {
          name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim().toLowerCase(),
          password: String(form.get("password") ?? ""),
          referralCode: String(form.get("referralCode") || referralParam || "").trim() || undefined,
        }
      : null;
    const payload = registrationPayload ?? {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    try {
      const response = await apiFetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? "Something went wrong");
        return;
      }
      if (mode === "register" && registrationPayload) {
        setPendingRegistration(registrationPayload);
        setMessage(result.data?.message ?? "Verification OTP sent. Check your email.");
        return;
      }
      const user = result?.data ?? result;
      const nextPath = searchParams.get("next");
      const defaultPath = user?.role === "admin" ? "/admin" : "/dashboard/services";
      router.push((nextPath?.startsWith("/") ? nextPath : defaultPath) as Route);
      router.refresh();
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingRegistration) return;

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch("/api/auth/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: pendingRegistration.email, otp }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? "Unable to verify email");
        return;
      }

      const user = result?.data ?? result;
      const nextPath = searchParams.get("next");
      const defaultPath = user?.role === "admin" ? "/admin" : "/dashboard/services";
      router.push((nextPath?.startsWith("/") ? nextPath : defaultPath) as Route);
      router.refresh();
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resendRegistrationOtp() {
    if (!pendingRegistration) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pendingRegistration),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? "Unable to resend verification code");
        return;
      }
      setMessage(result.data?.message ?? "A new verification code has been sent.");
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={pendingRegistration ? verifyRegistration : submit} className="grid gap-4">
      {pendingRegistration ? (
        <>
          <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
            We sent a 6-digit verification code to <span className="font-semibold">{pendingRegistration.email}</span>.
            Enter it to finish creating your account.
          </p>
          <label className="grid gap-2 text-sm font-semibold text-neutral-800">
            Email verification code
            <input
              name="otp"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              placeholder="Enter 6-digit code"
              className="h-12 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 shadow-sm transition placeholder:text-neutral-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            />
          </label>
        </>
      ) : (
        <>
          {mode === "register" && (
            <label className="grid gap-2 text-sm font-semibold text-neutral-800">
              Full name
              <input
                name="name"
                required
                placeholder="Enter your name"
                className="h-12 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 shadow-sm transition placeholder:text-neutral-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
              />
            </label>
          )}
          <label className="grid gap-2 text-sm font-semibold text-neutral-800">
            {mode === "login" ? "Email or mobile" : "Email"}
            <input
              name="email"
              type={mode === "login" ? "text" : "email"}
              required
              placeholder={mode === "login" ? "Email address or mobile number" : "you@example.com"}
              className="h-12 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 shadow-sm transition placeholder:text-neutral-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-neutral-800">
            Password
            <input
              name="password"
              type="password"
              minLength={8}
              maxLength={128}
              required
              placeholder="Minimum 8 characters"
              className="h-12 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 shadow-sm transition placeholder:text-neutral-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            />
          </label>
          {mode === "register" && referralEnabled && (
            <label className="grid gap-2 text-sm font-semibold text-neutral-800">
              Referral code <span className="text-xs font-medium text-neutral-500">Optional</span>
              <input
                name="referralCode"
                defaultValue={referralParam}
                placeholder="Enter code if you have one"
                className="h-12 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 shadow-sm transition placeholder:text-neutral-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
              />
            </label>
          )}
        </>
      )}
      {message && <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">{message}</p>}
      {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-60"
      >
        {loading
          ? "Please wait..."
          : pendingRegistration
            ? "Verify email and create account"
            : mode === "login"
              ? "Login"
              : "Send verification code"}
        {!loading && <ArrowRight className="size-4" />}
      </button>
      {pendingRegistration && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <button type="button" onClick={() => void resendRegistrationOtp()} disabled={loading} className="font-semibold text-teal-700 disabled:opacity-60">
            Resend code
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingRegistration(null);
              setOtp("");
              setError("");
              setMessage("");
            }}
            className="font-semibold text-neutral-600"
          >
            Change details
          </button>
        </div>
      )}
    </form>
  );
}
