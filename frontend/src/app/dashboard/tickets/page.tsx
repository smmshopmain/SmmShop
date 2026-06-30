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
      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Support center</p>
        <h1 className="mt-2 text-2xl font-bold text-neutral-950 sm:text-3xl">Support tickets</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
          Payment, order, refill aur account issues ke liye tickets create karein aur replies track karein.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <TicketForm />
        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
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
                    <p className="text-xs font-semibold uppercase text-neutral-500">{message.isAdmin ? "Admin" : "You"}</p>
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
              <p className="mt-1 max-w-md text-sm text-neutral-500">Koi issue ho to left form se ticket create karein.</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
