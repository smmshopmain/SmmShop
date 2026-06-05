"use client";

import React, { useEffect, useState } from "react";
import { DepositForm } from "@/components/deposit-form";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiJson } from "@/lib/client-api";

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Array<any>>([]);
  const [deposits, setDeposits] = useState<Array<any>>([]);
  const [payment, setPayment] = useState<any>({ qrImageUrl: "", upiId: "", accountNumber: "", ifsc: "", accountName: "", bankName: "", instructions: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await apiJson("/api/wallet");
        if (!mounted) return;
        setBalance(res?.balance ?? 0);
        setTransactions(Array.isArray(res?.transactions) ? res.transactions : []);
        // fetch deposits separately
        try {
          const depositsRes = await apiJson("/api/deposits");
          const depArray = Array.isArray(depositsRes?.deposits) ? depositsRes.deposits : (Array.isArray(depositsRes) ? depositsRes : []);
          setDeposits(depArray);
        } catch {
          setDeposits([]);
        }
        try {
          const paymentRes = await apiJson("/api/payment-details");
          setPayment(paymentRes?.payment ?? payment);
        } catch {
          // ignore
        }
      } catch (error) {
        setTransactions([]);
        setDeposits([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Wallet</h1>
        <p className="mt-1 text-sm text-neutral-600">Balance: Rs.{balance}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <DepositForm payment={payment} />
        <section className="rounded-md border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 p-4">
            <h2 className="font-semibold">Deposit requests</h2>
          </div>
          <div className="divide-y divide-neutral-100">
            {Array.isArray(deposits) && deposits.length > 0 ? deposits.map((deposit) => (
              <div key={String(deposit._id)} className="grid gap-2 p-4 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <span>
                  <span className="block font-medium">{deposit.depositId ?? String(deposit._id)}</span>
                  <span className="block text-neutral-500">UTR {deposit.utr}</span>
                </span>
                <StatusBadge status={deposit.status} />
                <strong>Rs.{deposit.amount}</strong>
              </div>
            )) : <p className="p-4 text-sm text-neutral-500">No deposits yet.</p>}
          </div>
        </section>
      </div>
      <section className="mt-6 rounded-md border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 p-4">
          <h2 className="font-semibold">Transaction history</h2>
        </div>
        {Array.isArray(transactions) && transactions.length > 0 ? transactions.map((tx) => (
          <div key={String(tx._id)} className="flex items-center justify-between border-b border-neutral-100 p-4 text-sm">
            <span>{(tx.type ?? "").replaceAll("_", " ")}</span>
            <strong>Rs.{tx.amount}</strong>
          </div>
        )) : <p className="p-4 text-sm text-neutral-500">No transactions yet.</p>}
      </section>
    </AppShell>
  );
}
