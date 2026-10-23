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
      <section className="profile-command mb-6 grid gap-5 overflow-hidden rounded-[1.7rem] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800">
            <UserRound className="size-3.5" /> Account center
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-950">Your profile & security</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">Keep your contact details current and protect your workspace with a strong password.</p>
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
      <div className="profile-workspace grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <ProfileSettingsForm profile={profile} />
        <ChangePasswordForm />
      </div>
    </AppShell>
  );
}
