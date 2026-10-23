import { AppShell } from "@/components/app-shell";
import { ServiceBrowser } from "@/components/service-browser";
import { ArrowUpRight, BadgeCheck, Zap } from "lucide-react";
import Link from "next/link";

export default function ServicesPage() {
  return (
    <AppShell>
      <section className="service-page-hero mb-6 overflow-hidden rounded-[1.8rem] bg-slate-950 px-5 py-6 text-white shadow-xl shadow-slate-900/10 sm:px-8 sm:py-8">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-teal-200/20 bg-teal-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-100">
              <Zap className="size-3.5" /> Campaign studio
            </p>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Make your next move count.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Explore social growth services, compare delivery options, and launch campaigns from one simple workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/orders" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10">
              Track orders <ArrowUpRight className="size-3.5" />
            </Link>
            <Link href="/dashboard/wallet" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900 transition hover:bg-teal-50">
              <BadgeCheck className="size-3.5 text-teal-700" /> Add funds
            </Link>
          </div>
        </div>
      </section>
      <ServiceBrowser />
    </AppShell>
  );
}
