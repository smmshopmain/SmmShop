"use client";

import { KeyRound, Mail } from "lucide-react";
import { useState } from "react";

export function ProfileSettingsForm({
  profile,
}: {
  profile: { name: string; email: string; phone: string; referralCode: string; role: "user" | "admin" };
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        phone: form.get("phone"),
      }),
    });
    const result = await response.json();
    setLoading(false);
    setMessage(response.ok ? "Profile updated." : (result.message ?? "Unable to update profile"));
    if (response.ok) window.location.reload();
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={submit} className="rounded-md border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Account settings</h2>
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          <label className="grid gap-2 font-medium">
            Name
            <input
              name="name"
              defaultValue={profile.name}
              required
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="grid gap-2 font-medium">
            Phone
            <input
              name="phone"
              defaultValue={profile.phone}
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="grid gap-2 font-medium">
            Email
            <input
              value={profile.email}
              readOnly
              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-600"
            />
          </label>
          <label className="grid gap-2 font-medium">
            Referral code
            <input
              value={profile.referralCode}
              readOnly
              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-600"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            disabled={loading}
            className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save profile"}
          </button>
          {message && <p className="text-sm text-neutral-600">{message}</p>}
        </div>
      </form>
      {profile.role === "admin" && <AdminEmailChangeForm currentEmail={profile.email} />}
    </div>
  );
}

function AdminEmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/change-email/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: nextEmail }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? (result.data?.message ?? "OTP sent.") : (result.message ?? "Unable to send OTP"));
    if (response.ok) setPendingEmail(nextEmail);
  }

  async function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/change-email/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: pendingEmail,
        otp: form.get("otp"),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "Email changed successfully." : (result.message ?? "Unable to change email"));
    if (response.ok) window.location.reload();
  }

  return (
    <section className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Mail className="size-5 text-teal-700" />
        <h2 className="text-lg font-semibold">Change admin email</h2>
      </div>
      <form onSubmit={requestOtp} className="mt-4 grid gap-4 text-sm md:grid-cols-[1fr_auto] md:items-end">
        <label className="grid gap-2 font-medium">
          New email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            placeholder={currentEmail}
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        <button
          disabled={loading}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send OTP"}
        </button>
      </form>
      {pendingEmail && (
        <form onSubmit={verifyOtp} className="mt-4 grid gap-4 text-sm md:grid-cols-[180px_auto] md:items-end">
          <label className="grid gap-2 font-medium">
            OTP
            <input
              name="otp"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>
          <button
            disabled={loading}
            className="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify and change"}
          </button>
        </form>
      )}
      {message && <p className="mt-4 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{message}</p>}
    </section>
  );
}

export function ChangePasswordForm() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setMessage("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.get("currentPassword"),
        newPassword,
      }),
    });
    const result = await response.json();
    setLoading(false);
    setMessage(response.ok ? "Password changed successfully." : (result.message ?? "Unable to change password"));
    if (response.ok) event.currentTarget.reset();
  }

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-4 rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-teal-700" />
        <h2 className="text-lg font-semibold">Change password</h2>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Current password
        <input
          name="currentPassword"
          type="password"
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
      <label className="grid gap-2 text-sm font-medium">
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          minLength={8}
          required
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      {message && <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm">{message}</p>}
      <button
        disabled={loading}
        className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save password"}
      </button>
    </form>
  );
}
