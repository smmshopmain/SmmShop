import { TicketReplyForm } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { TicketForm } from "@/components/ticket-form";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { Ticket } from "@/models";

export default async function TicketsPage() {
  let tickets: Array<{
    _id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: Date;
    messages: Array<{ body: string; isAdmin: boolean; createdAt: Date }>;
  }> = [];

  try {
    const { auth } = await requireUser();
    tickets = (await Ticket.find({ user: auth.id }).sort({ createdAt: -1 }).lean()) as typeof tickets;
  } catch {
    tickets = [];
  }

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
                {(ticket.messages ?? []).slice(-3).map((message, index) => (
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
