import { AppShell } from "@/components/app-shell";
import { ReferralPanel } from "@/components/referral-panel";
import { serverApiJson } from "@/lib/server-api";
import { ArrowUpRight, Gift, Users } from "lucide-react";

export default async function ReferralsPage() {
  let referralCode = "";
  let earnings = 0;
  let history: Array<{ _id: string; earnings: number; status: string; createdAt: string }> = [];
  let referralEnabled = true;

  try {
    const user = await serverApiJson("/api/auth/me");
    const [referrals, settings] = await Promise.all([
      serverApiJson("/api/referrals").catch(() => ({ history: [] })),
      serverApiJson("/api/settings").catch(() => ({ referrals: { enabled: true } })),
    ]);
    referralCode = user.referralCode ?? "";
    earnings = Number(user.referralEarnings ?? 0);
    history = Array.isArray(referrals.history) ? referrals.history : [];
    referralEnabled = settings?.referrals?.enabled !== false;
  } catch {
    history = [];
  }

  return (
    <AppShell>
      <section className="referrals-command mb-6 grid gap-5 overflow-hidden rounded-[1.7rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-900/10 sm:p-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-teal-200/20 bg-teal-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.17em] text-teal-100">
            <Gift className="size-3.5" /> Invite & earn
          </p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Grow your network. Earn together.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
            Share your referral link and follow earnings from successful referred users in your reward center.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5">
          <span className="pointer-events-none absolute -right-6 -top-8 size-32 rounded-full border border-white/10 shadow-[0_0_0_20px_rgba(255,255,255,0.025)]" />
          <div className="relative flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-teal-300/10 text-teal-100"><Users className="size-5" /></span>
            <ArrowUpRight className="size-4 text-teal-100" />
          </div>
          <p className="relative mt-4 text-xs font-semibold text-slate-300">Referral earnings</p>
          <p className="relative mt-1 text-2xl font-extrabold">Rs.{earnings.toFixed(2)}</p>
        </div>
      </section>
      <ReferralPanel
        initialReferralCode={referralCode}
        initialEarnings={earnings}
        initialHistory={history}
        initialEnabled={referralEnabled}
      />
    </AppShell>
  );
}
