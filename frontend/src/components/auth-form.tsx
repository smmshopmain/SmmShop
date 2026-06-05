"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
            referralCode: form.get("referralCode") || undefined,
          };
    const response = await fetch(`/api/auth/${mode}`, {
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
    router.push(searchParams.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {mode === "register" && (
        <label className="grid gap-2 text-sm font-medium">
          Name
          <input name="name" required className="rounded-md border border-neutral-300 px-3 py-2" />
        </label>
      )}
      <label className="grid gap-2 text-sm font-medium">
        {mode === "login" ? "Email or mobile" : "Email"}
        <input
          name="email"
          type={mode === "login" ? "text" : "email"}
          required
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          minLength={8}
          required
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      {mode === "register" && (
        <label className="grid gap-2 text-sm font-medium">
          Referral code
          <input name="referralCode" className="rounded-md border border-neutral-300 px-3 py-2" />
        </label>
      )}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <button
        disabled={loading}
        className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
      </button>
    </form>
  );
}
