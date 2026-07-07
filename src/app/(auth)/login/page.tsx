import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, LockKeyhole, Sparkles } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/auth";

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard/services");

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-md bg-teal-700 text-sm font-bold text-white shadow-sm">SP</span>
            <span>
              <span className="block text-lg font-bold text-neutral-950">SMM Panel</span>
              <span className="block text-sm text-neutral-600">Fast reseller workspace</span>
            </span>
          </Link>
          <div className="mt-12 max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-teal-800">
              <Sparkles className="size-3.5" /> User-friendly panel
            </p>
            <h1 className="mt-5 text-5xl font-bold leading-tight text-neutral-950">Manage services, wallet and orders without confusion.</h1>
            <p className="mt-5 text-lg leading-8 text-neutral-700">
              After login, users go directly to the services page with search, filters, and the order form ready.
            </p>
            <div className="mt-8 grid max-w-lg gap-3">
              {["Mobile friendly navigation", "Clear wallet and order status", "Secure session access"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-md border border-white bg-white/70 p-3 shadow-sm">
                  <CheckCircle2 className="size-5 text-teal-700" />
                  <span className="text-sm font-semibold text-neutral-800">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full rounded-lg border border-white bg-white p-5 shadow-xl shadow-neutral-900/10 sm:p-7">
          <div className="mb-7 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 lg:hidden">
              <span className="grid size-10 place-items-center rounded-md bg-teal-700 text-sm font-bold text-white">SP</span>
              <span className="text-sm font-bold text-neutral-950">SMM Panel</span>
            </Link>
            <span className="ml-auto grid size-10 place-items-center rounded-md bg-teal-50 text-teal-800">
              <LockKeyhole className="size-5" />
            </span>
          </div>
          <h2 className="text-2xl font-bold text-neutral-950">Welcome back</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">Log in to start placing orders directly from the services page.</p>
          <div className="mt-7">
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
        </div>
      </section>
    </main>
  );
}
