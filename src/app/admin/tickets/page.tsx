import { TicketReplyForm } from "@/components/admin-controls";
import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireAdmin } from "@/lib/auth";
import { Ticket } from "@/models";
import { Headphones, MessageSquareText } from "lucide-react";

export default async function AdminTicketsPage() {
  let tickets: Array<{
    _id: string;
    subject: string;
    status: string;
    priority: string;
    messages: Array<{ body: string; isAdmin: boolean; createdAt: Date }>;
    user?: { name?: string; email?: string };
  }> = [];

  try {
    await requireAdmin();
    tickets = (await Ticket.find().populate("user", "name email").sort({ updatedAt: -1 }).limit(100).lean()) as typeof tickets;
  } catch {
    tickets = [];
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Support operations"
        title="Support tickets"
        description="Review customer issues, reply as admin, and close resolved conversations."
      />
      <AdminSection title="Ticket inbox" description="Latest customer conversations and support actions" icon={Headphones}>
        {tickets.map((ticket) => (
          <div key={String(ticket._id)} className="border-b border-neutral-100 p-4 text-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_100px_110px] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold text-neutral-950">{ticket.subject}</p>
                <p className="text-neutral-500">{ticket.user?.email ?? "User"}</p>
              </div>
              <span className="rounded-md bg-neutral-100 px-2 py-1 text-center text-xs font-semibold text-neutral-700">{ticket.priority}</span>
              <StatusBadge status={ticket.status} />
            </div>
            <div className="mt-3 grid gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
              {(ticket.messages ?? []).slice(-3).map((message, index) => (
                <div key={`${ticket._id}-${index}`} className="rounded-md bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-neutral-500">{message.isAdmin ? "Admin" : "User"}</p>
                  <p className="mt-1 text-neutral-700">{message.body}</p>
                </div>
              ))}
            </div>
            {ticket.status !== "Closed" && <TicketReplyForm ticketId={String(ticket._id)} />}
          </div>
        ))}
        {tickets.length === 0 && <AdminEmptyState icon={MessageSquareText} title="No support tickets yet" description="New customer support conversations will appear here." />}
      </AdminSection>
    </AppShell>
  );
}
