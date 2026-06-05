"use client";

import React, { useEffect, useState } from "react";
import { TicketReplyForm } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { TicketForm } from "@/components/ticket-form";
import { StatusBadge } from "@/components/status-badge";
import { apiJson } from "@/lib/client-api";

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await apiJson("/api/tickets");
        if (!mounted) return;
        setTickets(res?.tickets ?? res?.data ?? []);
      } catch {
        if (mounted) setTickets([]);
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
      <h1 className="mb-6 text-2xl font-semibold">Support tickets</h1>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <TicketForm />
        <section className="rounded-md border border-neutral-200 bg-white">
          {tickets.map((ticket) => (
            <div key={String(ticket._id)} className="border-b border-neutral-100 p-4 text-sm">
              <div className="grid gap-2 md:grid-cols-[1fr_100px_100px]">
                <span className="font-medium">{ticket.subject}</span>
                <span>{ticket.priority}</span>
                <StatusBadge status={ticket.status} />
              </div>
              <div className="mt-3 rounded-md bg-neutral-50 p-3">
                {(ticket.messages ?? []).slice(-3).map((message: any, index: number) => (
                  <p key={`${ticket._id}-${index}`} className="mt-1 text-neutral-700">
                    <strong>{message.isAdmin ? "Admin" : "You"}:</strong> {message.body}
                  </p>
                ))}
              </div>
              {ticket.status !== "Closed" && <TicketReplyForm ticketId={String(ticket._id)} />}
            </div>
          ))}
          {tickets.length === 0 && <p className="p-4 text-sm text-neutral-500">No tickets yet.</p>}
        </section>
      </div>
    </AppShell>
  );
}
