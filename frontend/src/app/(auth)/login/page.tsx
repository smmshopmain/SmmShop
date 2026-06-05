"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { apiJson } from "@/lib/client-api";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    apiJson("/api/auth/me")
      .then((data) => {
        if (!mounted) return;
        if (data?.user || data?.ok) router.push("/dashboard");
      })
      .catch(() => {})
      .finally(() => {});
    return () => {
      mounted = false;
    };
  }, [router]);
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-neutral-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">Login</h1>
        <p className="mt-2 text-sm text-neutral-600">Access your SMM reseller dashboard.</p>
        <div className="mt-6">
          <AuthForm mode="login" />
        </div>
        <p className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
          <span>
            New here?{" "}
            <Link href="/register" className="font-semibold text-teal-700">
              Create an account
            </Link>
          </span>
          <Link href="/forgot-password" className="font-semibold text-teal-700">
            Forgot password?
          </Link>
        </p>
      </section>
    </main>
  );
}
