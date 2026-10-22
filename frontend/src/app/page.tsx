import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Layers3,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

const features = [
  {
    icon: Layers3,
    title: "A catalog that feels simple",
    text: "Find the right service quickly with platform filters, categories, and search.",
  },
  {
    icon: WalletCards,
    title: "Wallet, without the guesswork",
    text: "Keep deposits, available balance, and transaction history together.",
  },
  {
    icon: BarChart3,
    title: "Orders at a glance",
    text: "Follow every order from processing through completion in one workspace.",
  },
  {
    icon: ShieldCheck,
    title: "Tools for your whole team",
    text: "Manage providers, pricing, users, and support from the admin console.",
  },
];

export default function Home() {
  return (
    <main className="auth-page page-enter min-h-screen overflow-hidden">
      <section className="mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-16 lg:px-10">
        <div className="relative z-10 py-4">
          <Link href="/" className="mb-12 inline-flex items-center gap-3">
            <span className="brand-mark grid size-12 place-items-center rounded-2xl text-sm font-bold text-white">SP</span>
            <span>
              <span className="block text-lg font-bold tracking-tight text-slate-950">SMM Panel</span>
              <span className="block text-sm text-slate-500">Your growth workspace</span>
            </span>
          </Link>

          <p className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/80 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-teal-800 shadow-sm">
            <Sparkles className="size-3.5" /> Built for resellers
          </p>
          <h1 className="mt-6 max-w-3xl text-5xl font-bold leading-[1.04] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
            Social growth,
            <span className="block bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-700 bg-clip-text text-transparent">
              made simpler.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Run your services, orders, wallet, and customer support from one clear, professional workspace.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/15 transition hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-xl"
            >
              Get started <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-6 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-600">
            {["Fast service search", "Mobile-ready dashboard", "Secure account access"].map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-4 text-teal-700" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
          <div className="float-soft absolute -right-4 -top-8 size-28 rounded-full bg-cyan-200/50 blur-2xl" />
          <div className="float-soft absolute -bottom-8 -left-7 size-36 rounded-full bg-teal-200/60 blur-3xl [animation-delay:1.5s]" />
          <div className="relative rounded-[2rem] border border-white/80 bg-white/75 p-3 shadow-[0_35px_90px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-4">
            <div className="home-preview overflow-hidden rounded-[1.5rem] p-5 text-white sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-teal-100">Your workspace</p>
                  <p className="mt-1 text-xl font-bold tracking-tight">Everything in sync</p>
                </div>
                <span className="glow-pulse grid size-10 place-items-center rounded-xl bg-white/10 text-teal-100">
                  <BarChart3 className="size-5" />
                </span>
              </div>

              <div className="mt-7 grid grid-cols-3 gap-2.5">
                {[
                  ["Wallet", "Rs. 0"],
                  ["Orders", "0"],
                  ["Active", "0"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.07] p-3 sm:p-4">
                    <p className="text-xs text-slate-300">{label}</p>
                    <p className="mt-2 text-lg font-bold tracking-tight sm:text-xl">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">Recent activity</span>
                  <span className="text-teal-200">View all</span>
                </div>
                <div className="mt-4 space-y-3">
                  {[0, 1].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-teal-300/10 text-teal-200">
                        {item === 0 ? <Layers3 className="size-4" /> : <WalletCards className="size-4" />}
                      </span>
                      <span className="flex-1">
                        <span className="block h-2 w-28 rounded-full bg-white/70" />
                        <span className="mt-2 block h-1.5 w-20 rounded-full bg-white/25" />
                      </span>
                      <span className="size-2 rounded-full bg-teal-300" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-2.5 p-2 sm:grid-cols-2 sm:p-3">
              {features.slice(0, 2).map((feature) => (
                <div key={feature.title} className="flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-teal-50/70">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800">
                    <feature.icon className="size-5" />
                  </span>
                  <span className="text-xs font-semibold leading-5 text-slate-700">{feature.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="surface-card p-5 hover:-translate-y-1">
              <span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-700/10">
                <feature.icon className="size-5" />
              </span>
              <h2 className="mt-4 font-bold tracking-tight text-slate-950">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
