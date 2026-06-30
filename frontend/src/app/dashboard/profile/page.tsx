import { ChangePasswordForm, ProfileSettingsForm } from "@/components/change-password-form";
import { AppShell } from "@/components/app-shell";
import { serverApiJson } from "@/lib/server-api";
import { roleLabel, UserRole } from "@/lib/roles";
import { ShieldCheck, UserRound } from "lucide-react";

export default async function ProfilePage() {
  let profile = { name: "", email: "", phone: "", referralCode: "", role: "user" as UserRole };

  try {
    const user = await serverApiJson("/api/auth/me");
    profile = {
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      referralCode: user.referralCode ?? "",
      role: user.role ?? "user",
    };
  } catch {
    profile = { name: "", email: "", phone: "", referralCode: "", role: "user" };
  }

  return (
    <AppShell>
      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Account settings</p>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950 sm:text-3xl">Profile</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">Account details, contact information aur password security manage karein.</p>
          </div>
          <div className="flex items-center gap-3 rounded-md bg-neutral-950 p-4 text-white">
            <span className="grid size-11 place-items-center rounded-md bg-white/10">
              {profile.role !== "user" ? <ShieldCheck className="size-5" /> : <UserRound className="size-5" />}
            </span>
            <span>
              <span className="block text-sm text-neutral-300">Signed in as</span>
              <span className="block truncate font-semibold">{roleLabel(profile.role)}</span>
            </span>
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <ProfileSettingsForm profile={profile} />
        <ChangePasswordForm />
      </div>
    </AppShell>
  );
}
