import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, ShieldCheck, UserPlus } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/auth";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/dashboard/services");

  return (
    <main className="auth-page public-login min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <section className="login-layout page-enter mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="login-story auth-visual hidden lg:block">
          <Link href="/" className="login-brand inline-flex items-center gap-3">
            <span className="brand-mark grid size-11 place-items-center rounded-2xl text-sm font-bold text-white shadow-sm">SP</span>
            <span>
              <span className="block text-lg font-bold text-neutral-950">SMM Panel</span>
              <span className="block text-sm text-neutral-600">Your social growth starts here</span>
            </span>
          </Link>
          <div className="mt-12 max-w-xl">
            <p className="login-kicker inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-teal-800">
              <ShieldCheck className="size-3.5" /> A better way to grow
            </p>
            <h1 className="login-title mt-5 text-5xl font-bold leading-tight text-neutral-950">Your next chapter starts with a stronger presence.</h1>
            <p className="mt-5 text-lg leading-8 text-neutral-700">
              Create your free account to discover services, follow your orders, and manage everything with ease.
            </p>
            <div className="login-benefits mt-8 grid max-w-lg gap-3">
              {["Get started in minutes", "Your progress, all in one place", "Friendly help whenever you need it"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-md border border-white bg-white/70 p-3 shadow-sm">
                  <BadgeCheck className="login-benefit-icon size-5 text-teal-700" />
                  <span className="text-sm font-semibold text-neutral-800">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="login-panel auth-card w-full p-5 sm:p-8">
          <div className="mb-7 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 lg:hidden">
              <span className="brand-mark grid size-10 place-items-center rounded-2xl text-sm font-bold text-white">SP</span>
              <span className="text-sm font-bold text-neutral-950">SMM Panel</span>
            </Link>
            <span className="ml-auto grid size-10 place-items-center rounded-md bg-teal-50 text-teal-800">
              <UserPlus className="size-5" />
            </span>
          </div>
          <h2 className="login-heading text-2xl font-bold text-neutral-950">Create account</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">Join us today and find the right services for your goals.</p>
          <div className="mt-7">
            <AuthForm mode="register" />
          </div>
          <p className="mt-5 text-sm text-neutral-600">
            Already registered?{" "}
            <Link href="/login" className="font-semibold text-teal-700">
              Login
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
