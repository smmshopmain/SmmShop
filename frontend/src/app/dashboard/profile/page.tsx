"use client";

import React, { useEffect, useState } from "react";
import { ChangePasswordForm, ProfileSettingsForm } from "@/components/change-password-form";
import { AppShell } from "@/components/app-shell";
import { apiJson } from "@/lib/client-api";

export default function ProfilePage() {
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", referralCode: "", role: "user" as "user" | "admin" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await apiJson("/api/auth/me");
        if (!mounted) return;
        const user = res?.user ?? res ?? null;
        if (user) {
          setProfile({ name: user.name ?? "", email: user.email ?? "", phone: user.phone ?? "", referralCode: user.referralCode ?? "", role: user.role ?? "user" });
        }
      } catch {
        if (mounted) setProfile({ name: "", email: "", phone: "", referralCode: "", role: "user" });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

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
