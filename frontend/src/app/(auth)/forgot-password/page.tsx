"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PasswordResetForm } from "@/components/password-reset-form";
import { apiJson } from "@/lib/client-api";

export default function ForgotPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    apiJson("/api/auth/me").then((data) => {
      if (!mounted) return;
      if (data?.user || data?.ok) router.push("/dashboard");
    }).catch(() => {}).finally(() => {});
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className="auth-page grid min-h-screen place-items-center px-4 py-10">
      <section className="auth-card page-enter w-full max-w-md p-6 sm:p-8">
        <Link href="/" className="mb-7 inline-flex items-center gap-3">
          <span className="brand-mark grid size-10 place-items-center rounded-xl text-xs font-bold text-white">SP</span>
          <span className="text-sm font-bold text-slate-900">SMM Panel</span>
        </Link>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">Account recovery</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Forgot password</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Enter your email, verify the OTP, and set a new password.
        </p>
        <div className="mt-6">
          <PasswordResetForm />
        </div>
        <p className="mt-5 text-sm text-neutral-600">
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-teal-700">
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
