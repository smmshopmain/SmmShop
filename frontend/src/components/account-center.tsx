"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import { ChangePasswordForm, ProfileSettingsForm } from "@/components/change-password-form";
import { apiJson } from "@/lib/client-api";
import { roleLabel, UserRole } from "@/lib/roles";

type AccountProfile = {
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  referralEarnings: number;
  walletBalance: number;
  createdAt: string;
  lastLoginAt: string;
  role: UserRole;
};

export function AccountCenter() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setLoadError("");
      try {
        const user = await apiJson("/api/auth/me", { cache: "no-store" });
        if (!user?.ok) {
          throw new Error(user?.message ?? "Unable to load account details.");
        }
        if (!active) return;
        setProfile({
          name: user.name ?? "",
          email: user.email ?? "",
          phone: user.phone ?? "",
          referralCode: user.referralCode ?? "",
          referralEarnings: Number(user.referralEarnings ?? 0),
          walletBalance: Number(user.walletBalance ?? 0),
          createdAt: user.createdAt ?? "",
          lastLoginAt: user.lastLoginAt ?? "",
          role: user.role ?? "user",
        });
      } catch {
        if (active) setLoadError("Unable to load account details. Check your connection and try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [retry]);

  if (loading) {
    return (
      <div className="grid gap-4" role="status" aria-label="Loading account details">
        <div className="h-36 animate-pulse rounded-[1.7rem] bg-neutral-200" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-neutral-200" />)}
        </div>
        <p className="text-center text-sm text-neutral-500">Loading your account details...</p>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
        <p className="font-semibold">{loadError || "Unable to load account details."}</p>
        <button
          type="button"
          onClick={() => setRetry((attempt) => attempt + 1)}
          className="mt-3 rounded-lg bg-rose-800 px-4 py-2 text-xs font-bold text-white hover:bg-rose-900"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <section className="profile-command mb-6 grid gap-5 overflow-hidden rounded-[1.7rem] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800">
            <UserRound className="size-3.5" /> Account center
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-950">{profile.name || "Your account"}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">{profile.email || "Account email not available"}</p>
        </div>
        <div className="profile-role-card flex items-center gap-3 rounded-2xl bg-slate-950 p-4 text-white">
          <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-teal-100">
            {profile.role !== "user" ? <ShieldCheck className="size-5" /> : <UserRound className="size-5" />}
          </span>
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300">Account access</span>
            <span className="mt-1 block truncate text-sm font-bold">{roleLabel(profile.role)}</span>
          </span>
        </div>
      </section>
      <div className="profile-overview mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProfileSummary label="Wallet balance" value={`Rs.${profile.walletBalance.toFixed(2)}`} />
        <ProfileSummary label="Referral earnings" value={`Rs.${profile.referralEarnings.toFixed(2)}`} />
        <ProfileSummary label="Member since" value={formatProfileDate(profile.createdAt)} />
        <ProfileSummary label="Last login" value={formatProfileDate(profile.lastLoginAt)} />
      </div>
      <div className="profile-workspace grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <ProfileSettingsForm profile={profile} />
        <ChangePasswordForm />
      </div>
    </>
  );
}

function formatProfileDate(value: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function ProfileSummary({ label, value }: { label: string; value: string }) {
  return (
    <section className="profile-summary rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-2 break-words text-lg font-extrabold tracking-tight text-neutral-950">{value}</p>
    </section>
  );
}
