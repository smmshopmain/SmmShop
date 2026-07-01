"use client";

import { ChevronDown, KeyRound, Mail, Phone, Save, UserRound } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { roleLabel, UserRole } from "@/lib/roles";

type Profile = { name: string; email: string; phone: string; referralCode: string; role: UserRole };

const inputClass =
  "h-11 rounded-md border border-neutral-300 px-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10";
const primaryButtonClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60 sm:w-auto";
const darkButtonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60 sm:w-auto";

export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage("");
    const response = await apiFetch("/api/auth/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
      }),
    });
    const result = await response.json();
    setLoading(false);
    setMessage(response.ok ? "Profile updated." : (result.message ?? "Unable to update profile"));
    if (response.ok) window.location.reload();
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-800">
            <UserRound className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-neutral-950">Your details</h2>
            <p className="truncate text-sm text-neutral-500">{profile.email || "Account information"}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <DetailItem label="Email" value={profile.email || "-"} />
          <DetailItem label="Phone" value={profile.phone || "Not set"} />
          <DetailItem label="Role" value={roleLabel(profile.role)} />
          <DetailItem label="Referral code" value={profile.referralCode || "-"} mono />
        </div>

        <form onSubmit={submit} className="mt-5 border-t border-neutral-100 pt-4">
          <div className="grid gap-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="grid gap-2 font-semibold text-neutral-800">
              Name
              <input name="name" defaultValue={profile.name} required className={inputClass} />
            </label>
            <button disabled={loading} className={primaryButtonClass}>
              <Save className="size-4" />
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
          {message && <p className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-600">{message}</p>}
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-4 py-3 sm:px-5">
          <h2 className="text-base font-bold text-neutral-950">Contact changes</h2>
        </div>
        <EmailChangeForm currentEmail={profile.email} />
        <PhoneChangeForm currentPhone={profile.phone} />
      </section>
    </div>
  );
}

function DetailItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 break-words text-sm font-semibold text-neutral-950 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function ActionPanel({
  icon,
  title,
  value,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b border-neutral-100 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 marker:hidden sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-800">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-neutral-950">{title}</span>
          {value && <span className="mt-0.5 block truncate text-xs font-medium text-neutral-500">{value}</span>}
        </span>
        <ChevronDown className="size-4 shrink-0 text-neutral-400 transition group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 sm:px-5">{children}</div>
    </details>
  );
}

function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();
    setLoading(true);
    setMessage("");
    const response = await apiFetch("/api/auth/change-email/request", {
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
    const response = await apiFetch("/api/auth/change-email/verify", {
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
    <ActionPanel icon={<Mail className="size-4" />} title="Change email" value={currentEmail}>
      <form onSubmit={requestOtp} className="grid gap-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-2 font-semibold text-neutral-800">
          New email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            placeholder={currentEmail}
            className={inputClass}
          />
        </label>
        <button disabled={loading} className={darkButtonClass}>
          {loading ? "Sending..." : "Send OTP"}
        </button>
      </form>
      {pendingEmail && (
        <form onSubmit={verifyOtp} className="mt-3 grid gap-3 text-sm sm:grid-cols-[180px_auto] sm:items-end">
          <label className="grid gap-2 font-semibold text-neutral-800">
            OTP
            <input name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required className={inputClass} />
          </label>
          <button disabled={loading} className={primaryButtonClass}>
            {loading ? "Verifying..." : "Verify and change"}
          </button>
        </form>
      )}
      {message && <p className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{message}</p>}
    </ActionPanel>
  );
}

function PhoneChangeForm({ currentPhone }: { currentPhone: string }) {
  const [phone, setPhone] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextPhone = phone.trim();
    setLoading(true);
    setMessage("");
    const response = await apiFetch("/api/auth/change-phone/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: nextPhone }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? (result.data?.message ?? "OTP sent.") : (result.message ?? "Unable to send OTP"));
    if (response.ok) setPendingPhone(nextPhone);
  }

  async function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage("");
    const response = await apiFetch("/api/auth/change-phone/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: pendingPhone,
        otp: form.get("otp"),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "Phone changed successfully." : (result.message ?? "Unable to change phone"));
    if (response.ok) window.location.reload();
  }

  return (
    <ActionPanel icon={<Phone className="size-4" />} title="Change phone" value={currentPhone || "Not set"}>
      <form onSubmit={requestOtp} className="grid gap-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-2 font-semibold text-neutral-800">
          New phone
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            minLength={6}
            maxLength={25}
            placeholder={currentPhone || "Phone number"}
            className={inputClass}
          />
        </label>
        <button disabled={loading} className={darkButtonClass}>
          {loading ? "Sending..." : "Send OTP"}
        </button>
      </form>
      {pendingPhone && (
        <form onSubmit={verifyOtp} className="mt-3 grid gap-3 text-sm sm:grid-cols-[180px_auto] sm:items-end">
          <label className="grid gap-2 font-semibold text-neutral-800">
            OTP
            <input name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required className={inputClass} />
          </label>
          <button disabled={loading} className={primaryButtonClass}>
            {loading ? "Verifying..." : "Verify and change"}
          </button>
        </form>
      )}
      {message && <p className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{message}</p>}
    </ActionPanel>
  );
}

export function ChangePasswordForm() {
  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-4 py-3 sm:px-5">
        <h2 className="text-base font-bold text-neutral-950">Security</h2>
      </div>
      <CurrentPasswordChangeForm />
      <PasswordOtpChangeForm />
    </section>
  );
}

function CurrentPasswordChangeForm() {
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
    const response = await apiFetch("/api/auth/change-password", {
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
    <ActionPanel icon={<KeyRound className="size-4" />} title="Change password" value="Use current password">
      <form onSubmit={submit} className="grid gap-3 text-sm">
        <label className="grid gap-2 font-semibold text-neutral-800">
          Current password
          <input name="currentPassword" type="password" required className={inputClass} />
        </label>
        <label className="grid gap-2 font-semibold text-neutral-800">
          New password
          <input name="newPassword" type="password" minLength={8} required className={inputClass} />
        </label>
        <label className="grid gap-2 font-semibold text-neutral-800">
          Confirm new password
          <input name="confirmPassword" type="password" minLength={8} required className={inputClass} />
        </label>
        {message && <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">{message}</p>}
        <button disabled={loading} className={primaryButtonClass}>
          {loading ? "Saving..." : "Save password"}
        </button>
      </form>
    </ActionPanel>
  );
}

function PasswordOtpChangeForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    setLoading(true);
    setMessage("");
    const response = await apiFetch("/api/auth/change-password/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? (result.data?.message ?? "OTP sent.") : (result.message ?? "Unable to send OTP"));
    if (response.ok) setPending(true);
  }

  async function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("otpNewPassword") ?? "");
    const confirmPassword = String(form.get("otpConfirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setMessage("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    setMessage("");
    const response = await apiFetch("/api/auth/change-password/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        otp: form.get("otp"),
        newPassword,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "Password changed successfully." : (result.message ?? "Unable to change password"));
    if (response.ok) event.currentTarget.reset();
  }

  return (
    <ActionPanel icon={<Mail className="size-4" />} title="Change password with OTP" value="Email OTP">
      <button type="button" onClick={requestOtp} disabled={loading} className={darkButtonClass}>
        {loading ? "Sending..." : "Send OTP"}
      </button>
      {pending && (
        <form onSubmit={verifyOtp} className="mt-3 grid gap-3 text-sm">
          <label className="grid gap-2 font-semibold text-neutral-800">
            OTP
            <input name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required className={inputClass} />
          </label>
          <label className="grid gap-2 font-semibold text-neutral-800">
            New password
            <input name="otpNewPassword" type="password" minLength={8} required className={inputClass} />
          </label>
          <label className="grid gap-2 font-semibold text-neutral-800">
            Confirm new password
            <input name="otpConfirmPassword" type="password" minLength={8} required className={inputClass} />
          </label>
          <button disabled={loading} className={primaryButtonClass}>
            {loading ? "Verifying..." : "Verify and change"}
          </button>
        </form>
      )}
      {message && <p className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">{message}</p>}
    </ActionPanel>
  );
}
