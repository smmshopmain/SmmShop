"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Settings2,
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
type SupportMessageSettings = {
  welcomeMessage: string;
  closeMessage: string;
};

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

function priorityForCategory(category: TicketCategory): TicketPriority {
  if (category === "payment") return "High";
  if (category === "other") return "Low";
  return "Medium";
}

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
  const [expandedTickets, setExpandedTickets] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showSupportSettings, setShowSupportSettings] = useState(false);
  const [supportSettings, setSupportSettings] = useState<SupportMessageSettings>({
    welcomeMessage: "Hello {{name}}, thank you for contacting support. We have received your request and will help you shortly.",
    closeMessage: "Your support conversation has been closed. If you need more help, please create a new support request.",
  });
  const [loadingSupportSettings, setLoadingSupportSettings] = useState(false);
  const [savingSupportSettings, setSavingSupportSettings] = useState(false);
  const ticketRequestInProgress = useRef(false);

  const loadTickets = useCallback(async (background = false) => {
    if (ticketRequestInProgress.current) return;
    ticketRequestInProgress.current = true;
    if (!background) setLoading(true);
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
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load support tickets.");
    } finally {
      ticketRequestInProgress.current = false;
      if (!background) setLoading(false);
    }
  }, [isAdmin, priorityFilter, search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTickets(), isAdmin && search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadTickets, isAdmin, search, statusFilter, priorityFilter]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadTickets(true);
    };
    const timer = window.setInterval(refreshWhenVisible, 3000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadTickets]);

  async function updateTicket(ticketId: string, action: "reply" | "welcome" | "close" | "reopen" | "set_priority", priority?: TicketPriority) {
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

  async function toggleSupportSettings() {
    if (showSupportSettings) {
      setShowSupportSettings(false);
      return;
    }

    setShowSupportSettings(true);
    setLoadingSupportSettings(true);
    setActionError("");
    try {
      const result = await apiJson("/api/admin/settings", { cache: "no-store" });
      if (!result?.ok) throw new Error(result?.message || "Unable to load support settings.");
      if (result.support) setSupportSettings(result.support);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to load support settings.");
    } finally {
      setLoadingSupportSettings(false);
    }
  }

  async function saveSupportSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSupportSettings(true);
    setActionError("");
    try {
      const result = await apiJson("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ key: "support", value: supportSettings }),
      });
      if (!result?.ok) throw new Error(result?.message || "Unable to save support settings.");
      setActionError("");
      setShowSupportSettings(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to save support settings.");
    } finally {
      setSavingSupportSettings(false);
    }
  }

  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setActionError("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const category = categories.find(({ value }) => value === values.get("category"))?.value ?? "other";
    try {
      const result = await apiJson("/api/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: values.get("subject"),
          category,
          priority: priorityForCategory(category),
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
      <section className="support-hero overflow-hidden rounded-3xl p-5 shadow-xl sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="support-hero-eyebrow inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.17em]">
              {isAdmin ? <ShieldCheck className="size-3.5" /> : <Headphones className="size-3.5" />}
              {isAdmin ? "Support operations" : "Customer support"}
            </p>
            <h1 className="support-hero-title mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {isAdmin ? "Support inbox" : "How can we help?"}
            </h1>
            <p className="support-hero-description mt-2 text-sm leading-6">
              {isAdmin
                ? "Prioritize incoming requests, reply in context, and keep every customer issue moving."
                : "Create a request and continue the conversation here. Order, payment and account details stay together in one place."}
            </p>
          </div>
          <div className="support-hero-stats grid w-full grid-cols-3 gap-2 lg:w-[min(100%,330px)] lg:shrink-0">
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
                Describe the issue
                <textarea name="message" minLength={5} maxLength={5000} required rows={5} placeholder="Include relevant order ID, payment reference, what happened, and what you have tried." className="resize-y rounded-xl border border-neutral-300 px-3 py-2 font-normal" />
              </label>
              <p className="text-xs leading-5 text-neutral-500">Priority is assigned automatically based on the issue type. Support can adjust it if needed.</p>
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
                  {isAdmin
                    ? "Priorities are assigned by issue type. Review the selected priority and adjust it if needed."
                    : "Select a request to review its conversation. New replies appear automatically."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => void toggleSupportSettings()}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    <Settings2 className="size-4" />
                    Support settings
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <span className="workspace-live-dot size-2 rounded-full" />
                  Live
                </span>
                <button type="button" onClick={() => void loadTickets()} disabled={loading} aria-label="Refresh tickets" className="grid size-10 place-items-center rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
                  <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
            {isAdmin && showSupportSettings && (
              <form onSubmit={saveSupportSettings} className="mt-4 grid gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div>
                  <h3 className="font-bold text-neutral-900">Conversation messages</h3>
                  <p className="mt-1 text-xs text-neutral-500">Use {"{{name}}"} for the customer name and {"{{subject}}"} for the ticket subject.</p>
                </div>
                {loadingSupportSettings ? (
                  <p className="inline-flex items-center gap-2 text-sm text-neutral-500"><LoaderCircle className="size-4 animate-spin" /> Loading settings...</p>
                ) : (
                  <>
                    <label className="grid gap-1.5 text-sm font-semibold text-neutral-800">
                      Welcome message
                      <textarea
                        required
                        maxLength={2000}
                        rows={3}
                        value={supportSettings.welcomeMessage}
                        onChange={(event) => setSupportSettings((current) => ({ ...current, welcomeMessage: event.target.value }))}
                        className="resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2 font-normal"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-neutral-800">
                      Conversation close message
                      <textarea
                        required
                        maxLength={2000}
                        rows={3}
                        value={supportSettings.closeMessage}
                        onChange={(event) => setSupportSettings((current) => ({ ...current, closeMessage: event.target.value }))}
                        className="resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2 font-normal"
                      />
                    </label>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowSupportSettings(false)} className="h-10 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-700">Cancel</button>
                      <button type="submit" disabled={savingSupportSettings} className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-60">
                        {savingSupportSettings && <LoaderCircle className="size-4 animate-spin" />}
                        Save messages
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}
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
              <article
                key={ticket._id}
                className={isAdmin
                  ? "border-b border-neutral-100 p-4 sm:p-5"
                  : "mx-3 my-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md sm:mx-4"}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    {isAdmin ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-neutral-950">{ticket.subject}</h3>
                          <StatusBadge status={ticket.status} />
                        </div>
                        <p className="mt-1 text-xs text-neutral-500">
                          #{ticket._id.slice(-7).toUpperCase()} · {categoryLabel(ticket.category)} · {formatDate(ticket.createdAt)}
                        </p>
                      </>
                    ) : (
                      <button
                        type="button"
                        aria-expanded={Boolean(expandedTickets[ticket._id])}
                        onClick={() => setExpandedTickets((current) => ({
                          ...current,
                          [ticket._id]: !current[ticket._id],
                        }))}
                        className="w-full text-left"
                      >
                        <span className="flex flex-wrap items-center justify-between gap-3">
                          <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate font-bold text-neutral-950">{ticket.subject}</span>
                            <StatusBadge status={ticket.status} />
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-teal-800">
                            {expandedTickets[ticket._id] ? "Hide conversation" : "View conversation"}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-neutral-500">
                          #{ticket._id.slice(-7).toUpperCase()} <span className="px-1">·</span> {categoryLabel(ticket.category)} <span className="px-1">·</span> Updated {formatDate(ticket.updatedAt)}
                        </span>
                        {!expandedTickets[ticket._id] && ticket.messages.length > 0 && (
                          <span className="mt-3 block truncate rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                            {ticket.messages[ticket.messages.length - 1].isAdmin ? "Support: " : "You: "}
                            {ticket.messages[ticket.messages.length - 1].body}
                          </span>
                        )}
                      </button>
                    )}
                    {isAdmin && ticket.user && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
                        <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" />{ticket.user.name || "Customer"}</span>
                        {ticket.user.email && <a className="hover:text-teal-700 hover:underline" href={`mailto:${ticket.user.email}`}>{ticket.user.email}</a>}
                        {ticket.user.phone && <a className="hover:text-teal-700 hover:underline" href={`tel:${ticket.user.phone}`}>{ticket.user.phone}</a>}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-2 text-xs text-neutral-600">
                        <span>Priority</span>
                        <select
                          aria-label="Ticket priority"
                          value={ticket.priority}
                          disabled={submitting}
                          onChange={(event) => void updateTicket(ticket._id, "set_priority", event.target.value as TicketPriority)}
                          className="max-w-24 bg-transparent font-semibold text-neutral-900"
                        >
                          <option>Low</option><option>Medium</option><option>High</option>
                        </select>
                      </label>
                      <span className="inline-flex items-center gap-1 text-xs text-neutral-500"><Clock3 className="size-3.5" /> Updated {formatDate(ticket.updatedAt)}</span>
                    </div>
                  )}
                </div>

                {(isAdmin || expandedTickets[ticket._id]) && <div className="mt-4 space-y-3">
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
                </div>}

                {(isAdmin || expandedTickets[ticket._id]) && <div className="mt-4 flex flex-wrap items-start gap-2">
                  {ticket.status !== "Closed" ? (
                    isAdmin && !ticket.messages.some((message) => message.isAdmin) ? (
                      <div className="flex flex-1 flex-col items-start gap-2">
                        <p className="text-xs text-neutral-500">Send the configured welcome message before writing a custom reply.</p>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void updateTicket(ticket._id, "welcome")}
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                        >
                          {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                          Send welcome message
                        </button>
                      </div>
                    ) : (
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
                    )
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                      <Check className="size-4 text-emerald-700" /> This request is closed.
                    </div>
                  )}
                  {(ticket.status !== "Closed" || isAdmin) && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void updateTicket(ticket._id, ticket.status === "Closed" ? "reopen" : "close")}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      {ticket.status === "Closed" ? <><ArrowUpRight className="size-4" /> Reopen</> : <><Check className="size-4" /> Close request</>}
                    </button>
                  )}
                </div>}
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
    <div className="support-hero-stat rounded-xl border px-2 py-3 text-center sm:px-3">
      <p className="text-xl font-extrabold">{count}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">{label}</p>
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
