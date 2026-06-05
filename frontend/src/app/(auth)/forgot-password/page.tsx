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
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-neutral-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">Forgot password</h1>
        <p className="mt-2 text-sm text-neutral-600">
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
