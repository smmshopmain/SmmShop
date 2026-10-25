"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Headphones,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Ticket,
  UserRound,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { apiJson } from "@/lib/client-api";

type TicketStatus = "Open" | "Answered" | "Closed";
type TicketPriority = "Low" | "Medium" | "High";
type TicketCategory = "account" | "order" | "payment" | "technical" | "other";

type SupportTicket = {
  _id: string;
  subject: string;
  category?: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    body: string;
    isAdmin: boolean;
    createdAt: string;
  }>;
  user?: {
    name?: string;
    email?: string;
    phone?: string;
  } | null;
};

const categories: Array<{ value: TicketCategory; label: string }> = [
  { value: "order", label: "Order or refill" },
  { value: "payment", label: "Payment or wallet" },
  { value: "account", label: "Account" },
  { value: "technical", label: "Website issue" },
  { value: "other", label: "Other" },
];

export function SupportDesk({ mode }: { mode: "user" | "admin" }) {
  const isAdmin = mode === "admin";
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const query = new URLSearchParams();
      if (isAdmin) {
        if (search.trim()) query.set("q", search.trim());
        if (statusFilter !== "all") query.set("status", statusFilter);
        if (priorityFilter !== "all") query.set("priority", priorityFilter);
      }
      const path = isAdmin
        ? `/api/admin/tickets${query.size ? `?${query.toString()}` : ""}`
        : "/api/tickets";
      const result = await apiJson(path, { cache: "no-store" });
      if (!result?.ok) throw new Error(result?.message || "Unable to load support tickets.");
      setTickets(Array.isArray(result.tickets) ? result.tickets : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load support tickets.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, priorityFilter, search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTickets(), isAdmin && search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadTickets, isAdmin, search, statusFilter, priorityFilter]);

  async function updateTicket(ticketId: string, action: "reply" | "close" | "reopen" | "set_priority", priority?: TicketPriority) {
    setSubmitting(true);
    setActionError("");
    try {
      const result = await apiJson("/api/tickets", {
        method: "PATCH",
        body: JSON.stringify({
          id: ticketId,
          action,
          ...(action === "reply" ? { message: replyText[ticketId] ?? "" } : {}),
          ...(priority ? { priority } : {}),
        }),
      });
      if (!result?.ok) throw new Error(result?.message || "Unable to update this ticket.");
      if (action === "reply") {
        setReplyText((current) => ({ ...current, [ticketId]: "" }));
      }
      await loadTickets();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update this ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setActionError("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const result = await apiJson("/api/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: values.get("subject"),
          category: values.get("category"),
          priority: values.get("priority"),
          message: values.get("message"),
        }),
      });
      if (!result?.ok) throw new Error(result?.message || "Unable to create your ticket.");
      form.reset();
      setStatusFilter("all");
      await loadTickets();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to create your ticket.");
    } finally {
      setCreating(false);
    }
  }

  const visibleTickets = isAdmin || statusFilter === "all"
    ? tickets
    : tickets.filter((ticket) => ticket.status === statusFilter);
  const openCount = tickets.filter((ticket) => ticket.status === "Open").length;
  const answeredCount = tickets.filter((ticket) => ticket.status === "Answered").length;
  const closedCount = tickets.filter((ticket) => ticket.status === "Closed").length;

  return (
    <div className="space-y-6">
      <section className={`overflow-hidden rounded-3xl p-5 text-white shadow-xl sm:p-7 ${isAdmin ? "bg-slate-950" : "bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950"}`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-teal-200/20 bg-teal-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.17em] text-teal-100">
              {isAdmin ? <ShieldCheck className="size-3.5" /> : <Headphones className="size-3.5" />}
              {isAdmin ? "Support operations" : "Customer support"}
            </p>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {isAdmin ? "Support inbox" : "How can we help?"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {isAdmin
                ? "Prioritize incoming requests, reply in context, and keep every customer issue moving."
                : "Create a request and continue the conversation here. Order, payment and account details stay together in one place."}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[330px]">
            <SummaryStat label="Open" count={openCount} />
            <SummaryStat label="Replied" count={answeredCount} />
            <SummaryStat label="Closed" count={closedCount} />
          </div>
        </div>
      </section>

      {actionError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{actionError}</p>
        </div>
      )}

      <div className={`grid items-start gap-6 ${isAdmin ? "" : "xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]"}`}>
        {!isAdmin && (
          <form onSubmit={createTicket} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-800">
                <Ticket className="size-5" />
              </span>
              <div>
                <h2 className="font-bold text-neutral-950">Start a support request</h2>
                <p className="text-sm text-neutral-500">Share enough detail for us to investigate.</p>
              </div>
            </div>
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-800">
                Issue type
                <select name="category" defaultValue="order" className="h-11 rounded-xl border border-neutral-300 bg-white px-3 font-normal">
                  {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-800">
                Subject
                <input name="subject" minLength={3} maxLength={160} required placeholder="For example: Order #12345 is delayed" className="h-11 rounded-xl border border-neutral-300 px-3 font-normal" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-800">
                Priority
                <select name="priority" defaultValue="Medium" className="h-11 rounded-xl border border-neutral-300 bg-white px-3 font-normal">
                  <option>Low</option><option>Medium</option><option>High</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-800">
                Describe the issue
                <textarea name="message" minLength={5} maxLength={5000} required rows={5} placeholder="Include relevant order ID, payment reference, what happened, and what you have tried." className="resize-y rounded-xl border border-neutral-300 px-3 py-2 font-normal" />
              </label>
              <p className="text-xs leading-5 text-neutral-500">Please do not include your password, OTP, or full payment-card details.</p>
              <button disabled={creating} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60">
                {creating ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                {creating ? "Sending request..." : "Send support request"}
              </button>
            </div>
          </form>
        )}

        <section className="min-w-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-neutral-950">{isAdmin ? "All customer requests" : "Your requests"}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {isAdmin ? "Manage replies, priorities, and resolution status." : "Select a request to review its full conversation."}
                </p>
              </div>
              <button type="button" onClick={() => void loadTickets()} disabled={loading} aria-label="Refresh tickets" className="grid size-10 place-items-center rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {isAdmin && (
                <label className="relative">
                  <span className="sr-only">Search tickets</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subject or category" className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm" />
                </label>
              )}
              <label className="relative">
                <span className="sr-only">Filter by status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 w-full appearance-none rounded-xl border border-neutral-300 bg-white px-3 pr-9 text-sm">
                  <option value="all">All statuses</option>
                  <option value="Open">Open</option>
                  <option value="Answered">Answered</option>
                  <option value="Closed">Closed</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-neutral-500" />
              </label>
              {isAdmin && (
                <label className="relative">
                  <span className="sr-only">Filter by priority</span>
                  <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-10 w-full appearance-none rounded-xl border border-neutral-300 bg-white px-3 pr-9 text-sm">
                    <option value="all">All priorities</option>
                    <option value="High">High priority</option>
                    <option value="Medium">Medium priority</option>
                    <option value="Low">Low priority</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-neutral-500" />
                </label>
              )}
            </div>
          </div>

          {loadError && (
            <div role="alert" className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <p>{loadError}</p>
              <button type="button" onClick={() => void loadTickets()} className="mt-2 font-bold underline">Try again</button>
            </div>
          )}
          {loading && tickets.length === 0 && (
            <div className="grid min-h-48 place-items-center text-sm text-neutral-500">
              <span className="inline-flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" /> Loading requests...</span>
            </div>
          )}
          {!loading && !loadError && visibleTickets.length === 0 && (
            <div className="grid min-h-56 place-items-center px-5 text-center">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-neutral-100 text-neutral-500"><CircleHelp className="size-6" /></span>
                <p className="mt-3 font-semibold text-neutral-900">{isAdmin ? "No matching tickets" : "No support requests yet"}</p>
                <p className="mt-1 text-sm text-neutral-500">{isAdmin ? "Try changing the search or filters." : "When you send a request, you can track every reply here."}</p>
              </div>
            </div>
          )}

          <div className="divide-y divide-neutral-100">
            {visibleTickets.map((ticket) => (
              <article key={ticket._id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-neutral-950">{ticket.subject}</h3>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      #{ticket._id.slice(-7).toUpperCase()} · {categoryLabel(ticket.category)} · {formatDate(ticket.createdAt)}
                    </p>
                    {isAdmin && ticket.user && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
                        <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" />{ticket.user.name || "Customer"}</span>
                        {ticket.user.email && <a className="hover:text-teal-700 hover:underline" href={`mailto:${ticket.user.email}`}>{ticket.user.email}</a>}
                        {ticket.user.phone && <a className="hover:text-teal-700 hover:underline" href={`tel:${ticket.user.phone}`}>{ticket.user.phone}</a>}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-2 text-xs text-neutral-600">
                      <span>Priority</span>
                      <select
                        aria-label="Ticket priority"
                        value={ticket.priority}
                        disabled={!isAdmin || submitting}
                        onChange={(event) => void updateTicket(ticket._id, "set_priority", event.target.value as TicketPriority)}
                        className="max-w-24 bg-transparent font-semibold text-neutral-900 disabled:cursor-default"
                      >
                        <option>Low</option><option>Medium</option><option>High</option>
                      </select>
                    </label>
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-500"><Clock3 className="size-3.5" /> Updated {formatDate(ticket.updatedAt)}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {(ticket.messages ?? []).map((message, index) => (
                    <div key={`${ticket._id}-${index}`} className={`flex ${message.isAdmin ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[82%] ${message.isAdmin ? "rounded-tl-md bg-slate-100 text-neutral-800" : "rounded-tr-md bg-teal-50 text-neutral-800"}`}>
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{message.isAdmin ? "Support team" : "You"}</p>
                          <time className="text-[10px] text-neutral-400">{formatDate(message.createdAt)}</time>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-start gap-2">
                  {ticket.status !== "Closed" ? (
                    <form
                      className="flex min-w-[min(100%,440px)] flex-1 items-end gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (replyText[ticket._id]?.trim()) void updateTicket(ticket._id, "reply");
                      }}
                    >
                      <label className="min-w-0 flex-1">
                        <span className="sr-only">Write a reply</span>
                        <textarea
                          rows={2}
                          maxLength={5000}
                          value={replyText[ticket._id] ?? ""}
                          onChange={(event) => setReplyText((current) => ({ ...current, [ticket._id]: event.target.value }))}
                          placeholder={isAdmin ? "Write a helpful reply..." : "Add information or reply..."}
                          className="w-full resize-y rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                        />
                      </label>
                      <button type="submit" disabled={submitting || !replyText[ticket._id]?.trim()} aria-label="Send reply" className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50">
                        {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                      <Check className="size-4 text-emerald-700" /> This request is closed.
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void updateTicket(ticket._id, ticket.status === "Closed" ? "reopen" : "close")}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {ticket.status === "Closed" ? <><ArrowUpRight className="size-4" /> Reopen</> : <><Check className="size-4" /> Close request</>}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center">
      <p className="text-xl font-extrabold">{count}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300">{label}</p>
    </div>
  );
}

function categoryLabel(category?: TicketCategory) {
  return categories.find((item) => item.value === category)?.label ?? "General support";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
