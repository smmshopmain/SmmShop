"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiJson } from "@/lib/client-api";

export default function RefillsPage() {
  const [refills, setRefills] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await apiJson("/api/refills");
        if (!mounted) return;
        setRefills(res?.refills ?? res?.data ?? []);
      } catch {
        if (mounted) setRefills([]);
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
        <h1 className="text-2xl font-semibold">Refills</h1>
        <p className="mt-1 text-sm text-neutral-600">Track refill requests for eligible completed orders.</p>
      </div>
      <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        <div className="divide-y divide-neutral-100">
          {refills.map((refill) => (
            <div key={String(refill._id)} className="grid gap-3 p-4 text-sm md:grid-cols-[1fr_140px_120px_150px]">
              <div>
                <p className="font-medium">Order {refill.order?.providerOrderId ?? "-"}</p>
                <p className="truncate text-neutral-500">{refill.order?.link ?? "Link unavailable"}</p>
              </div>
              <StatusBadge status={refill.status} />
              <span>{refill.providerRefillId ?? "Queued"}</span>
              <span className="text-neutral-500">{new Date(refill.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {refills.length === 0 && <p className="p-6 text-sm text-neutral-500">No refill requests yet.</p>}
        </div>
      </section>
    </AppShell>
  );
}
