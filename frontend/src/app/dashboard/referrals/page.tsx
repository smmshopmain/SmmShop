import { AppShell } from "@/components/app-shell";
import { ReferralPanel } from "@/components/referral-panel";
import { serverApiJson } from "@/lib/server-api";

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
      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Referral program</p>
        <h1 className="mt-2 text-2xl font-bold text-neutral-950 sm:text-3xl">Referrals</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
          Apna referral link share karein aur successful referred users se earnings track karein.
        </p>
      </div>
      <ReferralPanel
        initialReferralCode={referralCode}
        initialEarnings={earnings}
        initialHistory={history}
        initialEnabled={referralEnabled}
      />
    </AppShell>
  );
}
