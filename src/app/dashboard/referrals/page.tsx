import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { createUniqueReferralCode } from "@/lib/referral-code";
import { Referral, User, getSettings } from "@/models";
import { BadgeIndianRupee, Link2, Users } from "lucide-react";

export default async function ReferralsPage() {
  let referralCode = "";
  let referralLink = "";
  let earnings = 0;
  let history: Array<{ _id: string; earnings: number; status: string; createdAt: Date }> = [];

  try {
    const { auth, dbUser } = await requireUser();
    const settings = await getSettings();
    const referralSystemEnabled = settings?.referrals?.enabled !== false;
    if (!referralSystemEnabled) {
      return (
        <AppShell>
          <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-semibold text-neutral-700">Referral program is disabled by the administrator.</p>
          </div>
        </AppShell>
      );
    }
    if (!dbUser.referralCode) {
      dbUser.referralCode = await createUniqueReferralCode(User);
      await dbUser.save();
    }
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    const protocol = headerStore.get("x-forwarded-proto") ?? "https";
    const origin = host
      ? `${protocol}://${host}`
      : (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
    referralCode = dbUser.referralCode;
    referralLink = `${origin}/register?ref=${referralCode}`;
    earnings = dbUser.referralEarnings;
    history = (await Referral.find({ referrer: auth.id }).sort({ createdAt: -1 }).lean()) as typeof history;
  } catch {
    history = [];
  }

  return (
    <AppShell>
      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Referral program</p>
        <h1 className="mt-2 text-2xl font-bold text-neutral-950 sm:text-3xl">Referrals</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
          Share your referral link and track earnings from successful referred users.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-teal-50 text-teal-800">
              <Link2 className="size-5" />
            </span>
            <div>
              <h2 className="font-bold text-neutral-950">Unique referral link</h2>
              <p className="text-sm text-neutral-500">Share this link with new users</p>
            </div>
          </div>
          <p className="mt-4 break-all rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm font-semibold text-neutral-900">
            {referralLink || `/register?ref=${referralCode}`}
          </p>
          <p className="mt-3 text-xs text-neutral-500">Referral code: <span className="font-semibold text-neutral-800">{referralCode || "-"}</span></p>
        </section>

        <section className="rounded-lg bg-neutral-950 p-5 text-white shadow-sm">
          <BadgeIndianRupee className="size-7 text-teal-200" />
          <p className="mt-4 text-sm text-neutral-300">Referral earnings</p>
          <p className="mt-2 text-3xl font-bold">Rs.{earnings}</p>
          <p className="mt-3 text-sm text-neutral-400">Approved referral rewards</p>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-neutral-200 p-4">
          <span className="grid size-10 place-items-center rounded-md bg-neutral-100 text-neutral-700">
            <Users className="size-5" />
          </span>
          <div>
            <h2 className="font-bold text-neutral-950">Referral history</h2>
            <p className="text-sm text-neutral-500">Recent referral rewards and status</p>
          </div>
        </div>
        {history.map((item) => (
          <div key={String(item._id)} className="grid gap-2 border-b border-neutral-100 p-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
            <span>
              <span className="block font-medium">{item.status}</span>
              <span className="block text-xs text-neutral-500">{new Date(item.createdAt).toLocaleString()}</span>
            </span>
            <strong className="text-teal-700">Rs.{item.earnings}</strong>
          </div>
        ))}
        {history.length === 0 && (
          <div className="grid place-items-center px-4 py-12 text-center">
            <Users className="size-10 text-neutral-300" />
            <p className="mt-3 text-sm font-semibold text-neutral-800">No referral history yet</p>
            <p className="mt-1 max-w-md text-sm text-neutral-500">Rewards will appear here when your referred users become active.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
