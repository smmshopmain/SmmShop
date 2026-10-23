import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, LockKeyhole, Sparkles } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard/services");

  return (
    <main className="auth-page min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <section className="page-enter mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="auth-visual hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="brand-mark grid size-11 place-items-center rounded-2xl text-sm font-bold text-white shadow-sm">SP</span>
            <span>
              <span className="block text-lg font-bold text-neutral-950">SMM Panel</span>
              <span className="block text-sm text-neutral-600">Your social growth starts here</span>
            </span>
          </Link>
          <div className="mt-12 max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-teal-800">
              <Sparkles className="size-3.5" /> Your next big step
            </p>
            <h1 className="mt-5 text-5xl font-bold leading-tight text-neutral-950">Grow your presence. We’ll make it simple.</h1>
            <p className="mt-5 text-lg leading-8 text-neutral-700">
              Discover the services you need, place an order in moments, and follow every update from one easy place.
            </p>
            <div className="mt-8 grid max-w-lg gap-3">
              {["Find the right service in seconds", "Stay on top of orders and wallet", "Simple, secure account access"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-md border border-white bg-white/70 p-3 shadow-sm">
                  <CheckCircle2 className="size-5 text-teal-700" />
                  <span className="text-sm font-semibold text-neutral-800">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="auth-card w-full p-5 sm:p-8">
          <div className="mb-7 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 lg:hidden">
              <span className="brand-mark grid size-10 place-items-center rounded-2xl text-sm font-bold text-white">SP</span>
              <span className="text-sm font-bold text-neutral-950">SMM Panel</span>
            </Link>
            <span className="ml-auto grid size-10 place-items-center rounded-md bg-teal-50 text-teal-800">
              <LockKeyhole className="size-5" />
            </span>
          </div>
          <h2 className="text-2xl font-bold text-neutral-950">Welcome back</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">Sign in and pick up right where your growth journey left off.</p>
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
