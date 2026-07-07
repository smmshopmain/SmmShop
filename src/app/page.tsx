import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Layers3, ShieldCheck, WalletCards } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f4ee]">
      <section className="mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_500px] lg:px-8">
        <div className="py-8">
          <div className="mb-10 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-md bg-teal-700 text-sm font-bold text-white shadow-sm">SP</span>
            <span>
              <span className="block text-lg font-bold text-neutral-950">SMM Panel</span>
              <span className="block text-sm text-neutral-600">Reseller platform</span>
            </span>
          </div>
          <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-teal-800">
            <CheckCircle2 className="size-3.5" /> Mobile ready workspace
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight text-neutral-950 sm:text-6xl">
            SMM Panel Platform
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-700">
            Browse services, manage your wallet, track orders, and handle support tickets in one clean user-friendly panel.
          </p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
            >
              Create account <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold shadow-sm hover:bg-neutral-100"
            >
              Login
            </Link>
          </div>
          <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              ["24/7", "Order access"],
              ["Fast", "Service search"],
              ["Clean", "Mobile UI"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-md border border-white bg-white/75 p-4 shadow-sm">
                <p className="text-2xl font-bold text-neutral-950">{value}</p>
                <p className="mt-1 text-sm text-neutral-600">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-white bg-white p-4 shadow-xl shadow-neutral-900/10 sm:p-5">
          <div className="mb-4 rounded-md bg-neutral-950 p-4 text-white">
            <p className="text-sm font-semibold text-teal-200">Live panel preview</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ["Wallet", "Rs.0"],
                ["Orders", "0"],
                ["Active", "0"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-white/10 p-3">
                  <p className="text-xs text-neutral-300">{label}</p>
                  <p className="mt-2 text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            {[
              { icon: Layers3, title: "Browse services", text: "Platform filters, categories, search, and order form ready." },
              { icon: WalletCards, title: "Wallet and deposits", text: "Clear balance, deposits, and transaction history." },
              { icon: BarChart3, title: "Order tracking", text: "Quick overview of pending, active, and completed orders." },
              { icon: ShieldCheck, title: "Admin controls", text: "Providers, pricing, users and support management." },
            ].map((item) => (
              <div key={item.title} className="rounded-md border border-neutral-200 p-4 transition hover:border-teal-200 hover:bg-teal-50">
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
