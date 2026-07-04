"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/client-api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
    const form = new FormData(event.currentTarget);
    const payload =
      mode === "login"
        ? { email: form.get("email"), password: form.get("password") }
        : {
            name: form.get("name"),
            email: form.get("email"),
            password: form.get("password"),
            referralCode: form.get("referralCode") || referralParam || undefined,
          };
    const response = await apiFetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(result.message ?? "Something went wrong");
      return;
    }
    const nextPath = searchParams.get("next");
    router.push((nextPath?.startsWith("/") ? nextPath : "/dashboard/services") as Route);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
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
      {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      <button
        disabled={loading}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-60"
      >
        {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
        {!loading && <ArrowRight className="size-4" />}
      </button>
    </form>
  );
}
