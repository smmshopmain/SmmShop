import Link from "next/link";
import { ArrowRight, BarChart3, ShieldCheck, WalletCards } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50">
      <section className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_520px] lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">SMM reseller platform</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-normal text-neutral-950 sm:text-6xl">
            SMM Panel Platform
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-600">
            A full-stack reseller panel with wallet deposits, provider routing, order tracking, refills,
            promo codes, support tickets, analytics, admin controls, Telegram alerts, and cron-ready sync APIs.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Create account <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-neutral-100"
            >
              Login
            </Link>
          </div>
        </div>
        <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3">
            {[
              { icon: WalletCards, title: "Wallet and deposits", text: "Manual UTR verification with automatic mode toggle architecture." },
              { icon: BarChart3, title: "Provider pricing", text: "Global, category, and service margins with provider cost and profit storage." },
              { icon: ShieldCheck, title: "Admin controls", text: "RBAC, audit logs, wallet freezes, user bans, and provider failover-ready routing." },
            ].map((item) => (
              <div key={item.title} className="rounded-md border border-neutral-200 p-4">
                <item.icon className="size-5 text-teal-700" />
                <h2 className="mt-3 font-semibold">{item.title}</h2>
                <p className="mt-1 text-sm leading-6 text-neutral-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
