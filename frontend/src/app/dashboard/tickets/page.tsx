import { TicketReplyForm } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { TicketForm } from "@/components/ticket-form";
import { StatusBadge } from "@/components/status-badge";
import { serverApiJson } from "@/lib/server-api";
import { Headphones, MessageSquareText } from "lucide-react";

export default async function TicketsPage() {
  let tickets: Array<{
    _id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    messages: Array<{ body: string; isAdmin: boolean; createdAt: string }>;
  }> = [];

  try {
    const result = await serverApiJson("/api/tickets");
    tickets = Array.isArray(result.tickets) ? result.tickets : [];
  } catch {
    tickets = [];
  }

  return (
    <AppShell>
      <section className="support-command mb-6 grid gap-5 overflow-hidden rounded-[1.7rem] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800">
            <Headphones className="size-3.5" /> Support desk
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-950">We’re here to help.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            Open a conversation about payments, orders, refills, or your account and follow every reply here.
          </p>
        </div>
        <div className="support-promise rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
          <span className="grid size-9 place-items-center rounded-xl bg-white text-teal-800 shadow-sm">
            <MessageSquareText className="size-[18px]" />
          </span>
          <p className="mt-3 text-xs font-bold text-neutral-900">All in one conversation</p>
          <p className="mt-1 text-[11px] leading-5 text-neutral-600">Keep your issue details and support replies together for faster follow-up.</p>
        </div>
      </section>
      <div className="support-workspace grid gap-6 xl:grid-cols-[minmax(340px,0.78fr)_minmax(0,1.22fr)]">
        <TicketForm />
        <section className="support-conversations rounded-[1.5rem] border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-neutral-200 p-4">
            <span className="grid size-10 place-items-center rounded-md bg-neutral-100 text-neutral-700">
              <Headphones className="size-5" />
            </span>
            <div>
              <h2 className="font-bold text-neutral-950">Your conversations</h2>
              <p className="text-sm text-neutral-500">Latest tickets and support replies</p>
            </div>
          </div>
          {tickets.map((ticket) => (
            <div key={String(ticket._id)} className="border-b border-neutral-100 p-4 text-sm">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_100px_110px] md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-950">{ticket.subject}</p>
                  <p className="text-xs text-neutral-500">{new Date(ticket.createdAt).toLocaleString()}</p>
                </div>
                <span className="rounded-md bg-neutral-100 px-2 py-1 text-center text-xs font-semibold text-neutral-700">{ticket.priority}</span>
                <StatusBadge status={ticket.status} />
              </div>
              <div className="mt-3 grid gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                {(ticket.messages ?? []).slice(-3).map((message, index) => (
                  <div key={`${ticket._id}-${index}`} className="rounded-md bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-neutral-500">{message.isAdmin ? "Support team" : "You"}</p>
                    <p className="mt-1 text-neutral-700">{message.body}</p>
                  </div>
                ))}
              </div>
              {ticket.status !== "Closed" && <TicketReplyForm ticketId={String(ticket._id)} />}
            </div>
          ))}
          {tickets.length === 0 && (
            <div className="grid place-items-center px-4 py-12 text-center">
              <MessageSquareText className="size-10 text-neutral-300" />
              <p className="mt-3 text-sm font-semibold text-neutral-800">No tickets yet</p>
              <p className="mt-1 max-w-md text-sm text-neutral-500">Need a hand? Send our team a message and we’ll be happy to help.</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
