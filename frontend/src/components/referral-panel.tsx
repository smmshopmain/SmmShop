"use client";

import { BadgeIndianRupee, Link2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/client-api";

type ReferralHistoryItem = {
  _id: string;
  earnings: number;
  status: string;
  createdAt: string;
};

export function ReferralPanel({
  initialReferralCode,
  initialEarnings,
  initialHistory,
  initialEnabled,
}: {
  initialReferralCode: string;
  initialEarnings: number;
  initialHistory: ReferralHistoryItem[];
  initialEnabled: boolean;
}) {
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [earnings, setEarnings] = useState(initialEarnings);
  const [history, setHistory] = useState(initialHistory);
  const [referralEnabled, setReferralEnabled] = useState(initialEnabled);

  useEffect(() => {
    let active = true;

    async function loadReferralData() {
      const user = await apiJson("/api/auth/me");
      const [referrals, settings] = await Promise.all([
        apiJson("/api/referrals").catch(() => ({ history: [] })),
        apiJson("/api/settings").catch(() => ({ referrals: { enabled: true } })),
      ]);

      if (!active) return;
      setReferralCode(user.referralCode ?? "");
      setEarnings(Number(user.referralEarnings ?? 0));
      setHistory(Array.isArray(referrals.history) ? referrals.history : []);
      setReferralEnabled(settings?.referrals?.enabled !== false);
    }

    loadReferralData().catch(() => {
      if (active) setHistory(initialHistory);
    });

    return () => {
      active = false;
    };
  }, [initialHistory]);

  const referralLink = useMemo(() => {
    if (!referralCode) return "";
    if (typeof window === "undefined") return `/register?ref=${referralCode}`;
    return `${window.location.origin}/register?ref=${referralCode}`;
  }, [referralCode]);

  if (!referralEnabled) {
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
        Referral program is currently disabled by admin. The referral link and earnings section are hidden until it is turned on again.
      </div>
    );
  }

  return (
    <>
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
            {referralLink || "Generating referral link..."}
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            Referral code: <span className="font-semibold text-neutral-800">{referralCode || "-"}</span>
          </p>
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
            <p className="mt-1 max-w-md text-sm text-neutral-500">Aapke referred users active honge to rewards yahan dikhenge.</p>
          </div>
        )}
      </section>
    </>
  );
}
