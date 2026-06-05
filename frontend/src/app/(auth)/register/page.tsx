"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { apiJson } from "@/lib/client-api";

export default function RegisterPage() {
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
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-2 text-sm text-neutral-600">The first registered account becomes the initial admin.</p>
        <div className="mt-6">
          <AuthForm mode="register" />
        </div>
        <p className="mt-5 text-sm text-neutral-600">
          Already registered? <Link href="/login" className="font-semibold text-teal-700">Login</Link>
        </p>
      </section>
    </main>
  );
}
