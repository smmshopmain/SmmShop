import { ChangePasswordForm, ProfileSettingsForm } from "@/components/change-password-form";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

export default async function ProfilePage() {
  let profile = { name: "", email: "", phone: "", referralCode: "" };

  try {
    const { dbUser } = await requireUser();
    profile = {
      name: dbUser.name,
      email: dbUser.email,
      phone: dbUser.phone ?? "",
      referralCode: dbUser.referralCode ?? "",
    };
  } catch {
    profile = { name: "", email: "", phone: "", referralCode: "" };
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-neutral-600">Account details and password security.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <ProfileSettingsForm profile={profile} />
        <ChangePasswordForm />
      </div>
    </AppShell>
  );
}
