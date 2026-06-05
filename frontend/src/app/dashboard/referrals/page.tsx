"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { apiJson } from "@/lib/client-api";

export default function ReferralsPage() {
  const [referralCode, setReferralCode] = useState("");
  const [referralLink, setReferralLink] = useState("");
  const [earnings, setEarnings] = useState(0);
  const [history, setHistory] = useState<Array<any>>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const me = await apiJson("/api/auth/me");
        if (!mounted) return;
        const user = me?.user ?? me ?? {};
        setReferralCode(user.referralCode ?? "");
        setEarnings(user.referralEarnings ?? 0);
        // try to fetch referral history
        try {
          const res = await apiJson("/api/referrals");
          if (!mounted) return;
          setHistory(res?.history ?? res?.data ?? []);
        } catch {
          setHistory([]);
        }
        // build origin-aware link using window location
        if (typeof window !== "undefined") {
          setReferralLink(`${window.location.origin}/register?ref=${user.referralCode ?? ""}`);
        }
      } catch {
        setHistory([]);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Referrals</h1>
      <section className="mt-6 rounded-md border border-neutral-200 bg-white p-4">
        <p className="text-sm text-neutral-500">Unique referral link</p>
        <p className="mt-2 break-all rounded-md bg-neutral-100 p-3 text-sm font-medium">{referralLink || `/register?ref=${referralCode}`}</p>
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
