import { ChangePasswordForm, ProfileSettingsForm } from "@/components/change-password-form";
import { AppShell } from "@/components/app-shell";
import { serverApiJson } from "@/lib/server-api";
import { roleLabel, UserRole } from "@/lib/roles";
import { ShieldCheck, UserRound } from "lucide-react";

export default async function ProfilePage() {
  let profile = {
    name: "",
    email: "",
    phone: "",
    referralCode: "",
    referralEarnings: 0,
    walletBalance: 0,
    createdAt: "",
    lastLoginAt: "",
    role: "user" as UserRole,
  };
  let profileError = "";

  try {
    const user = await serverApiJson("/api/auth/me");
    profile = {
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      referralCode: user.referralCode ?? "",
      referralEarnings: Number(user.referralEarnings ?? 0),
      walletBalance: Number(user.walletBalance ?? 0),
      createdAt: user.createdAt ?? "",
      lastLoginAt: user.lastLoginAt ?? "",
      role: user.role ?? "user",
    };
  } catch {
    profileError = "Unable to load account details. Please try again shortly.";
  }

  return (
    <AppShell>
      {profileError ? (
        <div role="alert" className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          Account details could not be loaded: {profileError}
        </div>
      ) : (
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
      )}
    </AppShell>
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
