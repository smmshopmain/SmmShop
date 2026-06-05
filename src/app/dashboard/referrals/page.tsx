import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { Referral } from "@/models";

export default async function ReferralsPage() {
  let referralCode = "";
  let referralLink = "";
  let earnings = 0;
  let history: Array<{ _id: string; earnings: number; status: string; createdAt: Date }> = [];

  try {
    const { auth, dbUser } = await requireUser();
    const headerStore = await headers();
    const origin = headerStore.get("x-forwarded-host")
      ? `${headerStore.get("x-forwarded-proto") ?? "https"}://${headerStore.get("x-forwarded-host")}`
      : "";
    referralCode = dbUser.referralCode;
    referralLink = `${origin}/register?ref=${referralCode}`;
    earnings = dbUser.referralEarnings;
    history = (await Referral.find({ referrer: auth.id }).sort({ createdAt: -1 }).lean()) as typeof history;
  } catch {
    history = [];
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Referrals</h1>
      <section className="mt-6 rounded-md border border-neutral-200 bg-white p-4">
        <p className="text-sm text-neutral-500">Unique referral link</p>
        <p className="mt-2 break-all rounded-md bg-neutral-100 p-3 text-sm font-medium">
          {referralLink || `/register?ref=${referralCode}`}
        </p>
        <p className="mt-4 text-sm font-semibold">Referral earnings: Rs.{earnings}</p>
      </section>
      <section className="mt-6 rounded-md border border-neutral-200 bg-white">
        {history.map((item) => (
          <div key={String(item._id)} className="flex justify-between border-b border-neutral-100 p-4 text-sm">
            <span>{item.status}</span>
            <strong>Rs.{item.earnings}</strong>
          </div>
        ))}
        {history.length === 0 && <p className="p-4 text-sm text-neutral-500">No referral history yet.</p>}
      </section>
    </AppShell>
  );
}
