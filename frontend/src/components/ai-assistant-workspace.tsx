"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bot, Check, ImagePlus, LoaderCircle, Menu, Plus, Search, Send, Sparkles } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/client-api";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatConversation = {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};
type PendingAction = { id: string; name: string; summary: string };
type ConversationPage = { conversations: ChatConversation[]; nextOffset: number | null; total: number };

function isChatConversation(value: unknown): value is ChatConversation {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string" &&
      "title" in value &&
      typeof value.title === "string" &&
      "messageCount" in value &&
      typeof value.messageCount === "number" &&
      "createdAt" in value &&
      typeof value.createdAt === "string" &&
      "updatedAt" in value &&
      typeof value.updatedAt === "string",
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  return Boolean(
    value &&
      typeof value === "object" &&
      "role" in value &&
      (value.role === "user" || value.role === "assistant") &&
      "content" in value &&
      typeof value.content === "string",
  );
}

function parseChatHistory(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Unable to load your conversation history.");
  const history: ChatMessage[] = [];
  for (const message of value) {
    if (!isChatMessage(message)) throw new Error("Conversation history contains an invalid message.");
    history.push(message);
  }
  return history;
}

function parseConversationPage(value: unknown): ConversationPage {
  if (!value || typeof value !== "object" || !("conversations" in value) || !Array.isArray(value.conversations)) {
    throw new Error("Unable to load your conversation list.");
  }
  const conversations: ChatConversation[] = [];
  for (const conversation of value.conversations) {
    if (!isChatConversation(conversation)) throw new Error("Conversation list contains invalid data.");
    conversations.push(conversation);
  }
  return {
    conversations,
    nextOffset: "nextOffset" in value && typeof value.nextOffset === "number" ? value.nextOffset : null,
    total: "total" in value && typeof value.total === "number" ? value.total : conversations.length,
  };
}

function parseAssistantConversation(value: unknown): { conversationId: string; title: string; messages: ChatMessage[] } {
  if (
    !value ||
    typeof value !== "object" ||
    !("conversationId" in value) ||
    typeof value.conversationId !== "string" ||
    !("title" in value) ||
    typeof value.title !== "string" ||
    !("messages" in value)
  ) {
    throw new Error("Unable to load this conversation.");
  }
  return {
    conversationId: value.conversationId,
    title: value.title,
    messages: parseChatHistory(value.messages),
  };
}

function formatConversationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

async function fetchConversationPage(offset = 0) {
  const result = await apiJson(`/api/ai/assistant/history?list=1&offset=${offset}&limit=50`, { cache: "no-store" });
  if (!result?.ok) throw new Error(result?.message || "Unable to load your conversation list.");
  return parseConversationPage(result);
}

async function createAssistantConversation(requestId: string) {
  const result = await apiJson("/api/ai/assistant/history", {
    method: "POST",
    body: JSON.stringify({ requestId }),
  });
  if (!result?.ok) throw new Error(result?.message || "Unable to start a new chat.");
  return parseAssistantConversation(result);
}

function getSectionContext(pathname: string, admin: boolean) {
  const sections = admin
    ? [
      ["/admin/assistant", "AI assistant", "Ask about an admin task or inspect the current workspace section."],
        ["/admin/providers", "Providers", "Review provider health and enabled integrations."],
        ["/admin/services", "Services", "Find services and review availability or pricing."],
        ["/admin/pricing", "Pricing", "Review pricing and margin settings."],
        ["/admin/orders", "Orders", "Inspect recent orders and their current status."],
        ["/admin/users", "Users", "Find a customer and review their account status."],
        ["/admin/deposits", "Deposits", "Review pending wallet deposits."],
        ["/admin/promo-codes", "Promo codes", "Review active offers and promo codes."],
        ["/admin/tickets", "Support", "Review open customer support tickets."],
        ["/admin/notifications", "Notifications", "Review recent workspace notifications."],
        ["/admin/analytics", "Analytics", "Summarize key business metrics."],
        ["/admin/email", "Email management", "Create an email campaign, match a festival or offer banner, or review campaign status."],
        ["/admin/popups", "Popup campaigns", "Create or manage popup campaigns, set their schedule, and request artwork when needed."],
        ["/admin/settings", "Settings", "Review supported website and workspace settings."],
        ["/admin/errors", "Diagnostics", "Summarize current system issues."],
        ["/admin/audit-logs", "Audit logs", "Review recent administrative activity."],
        ["/admin", "Admin overview", "Summarize the current workspace overview."],
      ]
    : [
      ["/dashboard/assistant", "AI assistant", "Ask a question about your account, services, orders, or support."],
        ["/dashboard/services", "Services", "Find a service by platform or category."],
        ["/dashboard/orders", "My orders", "Review your recent orders."],
        ["/dashboard/refills", "Refills", "Explain refill eligibility and next steps."],
        ["/dashboard/wallet", "Wallet", "Explain wallet and deposit steps."],
          ["/dashboard/referrals", "Invite & earn", "Review your referral code and rewards."],
        ["/dashboard/tickets", "Support", "Get help or prepare a support request."],
          ["/dashboard/notifications", "Notifications", "Review your recent updates."],
        ["/dashboard/profile", "My account", "Get help with account settings."],
        ["/dashboard", "My dashboard", "Help with your account and recent activity."],
      ];
  const section = sections.find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return section
    ? { name: section[1], suggestion: section[2] }
    : { name: admin ? "Admin workspace" : "Customer workspace", suggestion: "Ask a question about this section." };
}

export function AIAssistantWorkspace({
  admin,
  compact = false,
  active = true,
}: {
  admin: boolean;
  compact?: boolean;
  active?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const fileInput = useRef<HTMLInputElement>(null);
  const messagesContainer = useRef<HTMLDivElement>(null);
  const openingRequestId = useRef<string | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [conversationTitle, setConversationTitle] = useState("New chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [historyNextOffset, setHistoryNextOffset] = useState<number | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [switchingConversation, setSwitchingConversation] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [text, setText] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [modelAvailable, setModelAvailable] = useState(true);
  const [uploadType, setUploadType] = useState<"email" | "popup">("email");
  const [attachment, setAttachment] = useState<{ url: string; type: "email" | "popup" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const sectionContext = getSectionContext(pathname, admin);
  const uploadDestination = sectionContext.name === "Email management"
    ? "email"
    : sectionContext.name === "Popup campaigns"
      ? "popup"
      : uploadType;
  const activeAttachment = attachment?.type === uploadDestination ? attachment : null;

  useEffect(() => {
    if (!active) {
      openingRequestId.current = null;
      return;
    }
    const requestId = openingRequestId.current ?? crypto.randomUUID();
    openingRequestId.current = requestId;
    let mounted = true;
    const refreshStatus = async () => {
      try {
        const result = await apiJson("/api/ai/assistant", { cache: "no-store" });
        if (!mounted) return false;
        if (!result?.ok || !result.enabled) {
          if (compact) {
            setEnabled(false);
            setError(result?.message || "AI assistant is unavailable. Check its settings or backend status.");
          } else {
            router.replace(admin ? "/admin/settings" : "/dashboard");
          }
          return false;
        }
        setEnabled(true);
        setModelAvailable(result.modelAvailable !== false);
        setError("");
        return true;
      } catch {
        if (!mounted) return false;
        if (compact) {
          setEnabled(false);
          setError("AI assistant could not be reached. Check the backend connection and try again.");
        } else {
          router.replace(admin ? "/admin/settings" : "/dashboard");
        }
        return false;
      }
    };
    const loadConversation = async () => {
      setLoading(true);
      setMessages([]);
      if (!await refreshStatus() || !mounted) {
        if (mounted) setLoading(false);
        return;
      }
      try {
        const conversation = await createAssistantConversation(requestId);
        if (mounted) {
          setConversationId(conversation.conversationId);
          setConversationTitle(conversation.title);
          setMessages(conversation.messages);
          setPendingActions([]);
          setHistoryOpen(false);
        }
        const page = await fetchConversationPage();
        if (mounted) {
          setConversations(page.conversations);
          setConversationTotal(page.total);
          setHistoryNextOffset(page.nextOffset);
        }
      } catch (historyError) {
        if (mounted) {
          setError(historyError instanceof Error ? historyError.message : "Unable to load your conversation history.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void loadConversation();
    const interval = compact ? undefined : window.setInterval(refreshStatus, 30_000);
    return () => {
      mounted = false;
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [active, admin, compact, router]);

  useEffect(() => {
    const container = messagesContainer.current;
    if (!container) return;
    container.scrollTop = historyOpen ? 0 : container.scrollHeight;
  }, [conversationId, historyOpen, messages, sending]);

  async function refreshConversationList() {
    setHistoryLoading(true);
    try {
      const page = await fetchConversationPage();
      setConversations(page.conversations);
      setConversationTotal(page.total);
      setHistoryNextOffset(page.nextOffset);
      const currentConversation = page.conversations.find((chat) => chat.id === conversationId);
      if (currentConversation) setConversationTitle(currentConversation.title);
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : "Unable to refresh your conversation list.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadOlderConversations() {
    if (historyNextOffset === null || historyLoading) return;
    setHistoryLoading(true);
    try {
      const page = await fetchConversationPage(historyNextOffset);
      setConversations((current) => [...current, ...page.conversations.filter((chat) => !current.some((item) => item.id === chat.id))]);
      setConversationTotal(page.total);
      setHistoryNextOffset(page.nextOffset);
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : "Unable to load older conversations.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function startNewChat() {
    if (switchingConversation || sending) return;
    setSwitchingConversation(true);
    setError("");
    try {
      const conversation = await createAssistantConversation(crypto.randomUUID());
      setConversationId(conversation.conversationId);
      setConversationTitle(conversation.title);
      setMessages(conversation.messages);
      setPendingActions([]);
      setAttachment(null);
      setText("");
      setHistoryOpen(false);
      await refreshConversationList();
    } catch (conversationError) {
      setError(conversationError instanceof Error ? conversationError.message : "Unable to start a new chat.");
    } finally {
      setSwitchingConversation(false);
    }
  }

  async function openConversation(id: string) {
    if (switchingConversation || sending) return;
    setSwitchingConversation(true);
    setError("");
    try {
      const result = await apiJson(`/api/ai/assistant/history?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!result?.ok) throw new Error(result?.message || "Unable to open this conversation.");
      const conversation = parseAssistantConversation(result);
      setConversationId(conversation.conversationId);
      setConversationTitle(conversation.title);
      setMessages(conversation.messages);
      setPendingActions([]);
      setAttachment(null);
      setText("");
      setHistoryOpen(false);
    } catch (conversationError) {
      setError(conversationError instanceof Error ? conversationError.message : "Unable to open this conversation.");
    } finally {
      setSwitchingConversation(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (!conversationId) {
      setError("Start a new chat before sending a message.");
      return;
    }
    const content = activeAttachment
      ? `${trimmed}\n\nUploaded ${activeAttachment.type === "email" ? "email campaign banner" : "website popup image"} URL: ${activeAttachment.url}`
      : trimmed;
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setText("");
    setAttachment(null);
    setSending(true);
    setError("");
    try {
      const result = await apiJson("/api/ai/assistant", {
        method: "POST",
        body: JSON.stringify({
          message: content,
          conversationId,
          pageContext: { path: pathname },
        }),
      });
      if (!result?.ok) throw new Error(result?.message || "Unable to get an AI response.");
      setMessages((current) => [...current, { role: "assistant", content: result.message }]);
      setPendingActions((current) => [
        ...current,
        ...(Array.isArray(result.pendingActions) ? result.pendingActions : []),
      ]);
      void refreshConversationList();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to get an AI response.");
    } finally {
      setSending(false);
    }
  }

  async function approveAction(action: PendingAction) {
    setSending(true);
    setError("");
    try {
      const result = await apiJson("/api/ai/assistant", {
        method: "POST",
        body: JSON.stringify({
          approveActionId: action.id,
          conversationId,
        }),
      });
      if (!result?.ok) throw new Error(result?.message || "Unable to approve this action.");
      setPendingActions((current) => current.filter((item) => item.id !== action.id));
      setMessages((current) => [...current, { role: "assistant", content: result.message }]);
      void refreshConversationList();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to approve this action.");
    } finally {
      setSending(false);
    }
  }

  async function cancelAction(action: PendingAction) {
    setSending(true);
    setError("");
    try {
      const result = await apiJson("/api/ai/assistant", {
        method: "POST",
        body: JSON.stringify({
          rejectActionId: action.id,
          conversationId,
        }),
      });
      if (!result?.ok) throw new Error(result?.message || "Unable to cancel this action.");
      setPendingActions((current) => current.filter((item) => item.id !== action.id));
      setMessages((current) => [...current, { role: "assistant", content: result.message }]);
      void refreshConversationList();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to cancel this action.");
    } finally {
      setSending(false);
    }
  }

  async function uploadImage(file?: File) {
    if (!file || uploading) return;
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      setError("Choose a JPG, PNG, or WEBP image larger than 0 bytes and no larger than 10 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const endpoint = uploadDestination === "email" ? "/api/admin/campaign-banner" : "/api/admin/site-popup-image";
      const response = await apiFetch(endpoint, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok || !result?.ok || !result?.data?.url) {
        throw new Error(result?.message || "Unable to upload this image.");
      }
      setAttachment({ url: result.data.url, type: uploadDestination });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload this image.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (loading) {
    return <div className="grid min-h-56 place-items-center"><LoaderCircle className="size-6 animate-spin text-teal-700" /></div>;
  }
  if (!enabled) {
    return compact
      ? <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error || "AI assistant is unavailable."}</p>
      : <div className="grid min-h-56 place-items-center"><LoaderCircle className="size-6 animate-spin text-teal-700" /></div>;
  }

  const renderedMessages = messages.map((message, index) => (
    <div
      key={`${index}-${message.role}`}
      className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
        message.role === "user"
          ? "ml-auto bg-teal-800 text-white"
          : "mr-auto border border-neutral-200 bg-white text-neutral-800 shadow-sm"
      }`}
    >
      {message.content}
    </div>
  ));
  const visibleConversations = conversations.filter((conversation) =>
    conversation.title.toLowerCase().includes(historyQuery.trim().toLowerCase()),
  );

  return (
    <section className={`mx-auto flex w-full flex-col overflow-hidden border border-neutral-200 bg-white shadow-sm ${compact ? "h-full rounded-2xl" : "max-w-4xl rounded-3xl"}`}>
      <header className={`shrink-0 border-b border-neutral-200 bg-gradient-to-br from-teal-950 to-slate-900 text-white ${compact ? "px-4 py-4" : "px-5 py-5 sm:px-7"}`}>
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10"><Sparkles className="size-5 text-teal-200" /></span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{admin ? "Admin AI assistant" : "Your AI assistant"}</h2>
            <p className="mt-1 text-xs text-teal-100/80">
              {sectionContext.name} · {admin
                ? "Section-aware workspace help and controlled operations."
                : "Help tailored to the section you are viewing."}
            </p>
          </div>
          <div className={`ml-auto flex shrink-0 items-center gap-1.5 ${compact ? "mr-12" : ""}`}>
            <button
              type="button"
              aria-label={historyOpen ? "Close chat history" : "Open chat history"}
              aria-expanded={historyOpen}
              onClick={() => {
                const nextOpen = !historyOpen;
                setHistoryOpen(nextOpen);
                if (nextOpen) void refreshConversationList();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              <Menu className="size-4" />
              <span className={compact ? "hidden sm:inline" : ""}>History</span>
            </button>
            <button
              type="button"
              disabled={sending || switchingConversation}
              onClick={() => void startNewChat()}
              aria-label="Start a new chat"
              title="Start a new chat"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-2 text-xs font-bold text-teal-950 transition hover:bg-teal-50 disabled:opacity-60"
            >
              <Plus className="size-4" />
              <span className={compact ? "hidden sm:inline" : ""}>New chat</span>
            </button>
          </div>
        </div>
      </header>

      <div ref={messagesContainer} className={`min-h-0 flex-1 space-y-4 overflow-y-auto bg-neutral-50/70 px-4 py-5 sm:px-7 ${compact ? "" : "min-h-72"}`}>
        {historyOpen ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-neutral-950">Your chats</p>
                <p className="mt-1 text-xs text-neutral-500">Private to this account · select a topic to continue</p>
              </div>
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-900">
                {conversationTotal}
              </span>
            </div>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-neutral-400" />
              <input
                type="search"
                value={historyQuery}
                onChange={(event) => setHistoryQuery(event.target.value)}
                placeholder="Search chat topics"
                aria-label="Search chat history"
                className="h-10 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10"
              />
            </label>
            {historyLoading && conversations.length === 0 && (
              <p className="flex items-center gap-2 rounded-xl bg-white p-4 text-sm text-neutral-500">
                <LoaderCircle className="size-4 animate-spin" /> Loading your chats...
              </p>
            )}
            {!historyLoading && visibleConversations.length === 0 && (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center">
                <p className="text-sm font-semibold text-neutral-800">
                  {historyQuery ? "No chats match that search." : "No previous chats yet."}
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">Start a new chat and its topic will appear here.</p>
              </div>
            )}
            <div className="space-y-2">
              {visibleConversations.map((conversation) => (
                <button
                  type="button"
                  key={conversation.id}
                  disabled={switchingConversation || sending}
                  onClick={() => void openConversation(conversation.id)}
                  aria-current={conversation.id === conversationId ? true : undefined}
                  className={`w-full rounded-xl border p-3 text-left transition disabled:opacity-60 ${
                    conversation.id === conversationId
                      ? "border-teal-300 bg-teal-50"
                      : "border-neutral-200 bg-white hover:border-teal-200 hover:bg-teal-50/50"
                  }`}
                >
                  <span className="block truncate text-sm font-semibold text-neutral-900">{conversation.title}</span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                    <span>{formatConversationDate(conversation.updatedAt)}</span>
                    <span>{conversation.messageCount} {conversation.messageCount === 1 ? "message" : "messages"}</span>
                  </span>
                </button>
              ))}
            </div>
            {historyNextOffset !== null && (
              <button
                type="button"
                disabled={historyLoading}
                onClick={() => void loadOlderConversations()}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
              >
                {historyLoading ? "Loading..." : "Load older chats"}
              </button>
            )}
          </>
        ) : (
          <>
        <p className="truncate text-[11px] font-semibold text-neutral-500">{conversationTitle}</p>
        {messages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-5 text-sm leading-6 text-neutral-600">
            <p className="flex items-center gap-2 font-semibold text-neutral-900"><Bot className="size-4 text-teal-700" />How can I help?</p>
            <p className="mt-2">{admin
              ? `You are in ${sectionContext.name}. ${sectionContext.suggestion} You can also ask for a workspace overview, campaign draft, or supported settings change.`
              : `You are in ${sectionContext.name}. ${sectionContext.suggestion} You can also search services, review your recent orders, or get support.`}</p>
            <button
              type="button"
              onClick={() => setText(sectionContext.suggestion)}
              className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-left text-xs font-semibold text-teal-900 hover:bg-teal-100"
            >
              Try: {sectionContext.suggestion}
            </button>
          </div>
        )}
        {renderedMessages}
        {sending && (
          <p role="status" className="flex items-center gap-2 text-xs font-medium text-neutral-500">
            <LoaderCircle className="size-4 animate-spin" /> Working on your request...
          </p>
        )}
        {pendingActions.map((action) => (
          <div key={action.id} className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-950">Approval required</p>
            <p className="mt-1 text-sm text-amber-900">{action.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={sending}
                onClick={() => void approveAction(action)}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                <Check className="size-4" /> Approve and apply
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => void cancelAction(action)}
                className="rounded-xl border border-amber-800 px-3 py-2 text-sm font-bold text-amber-950 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
            <p className="mt-2 text-xs text-amber-900">This approval expires after 10 minutes and can only be used once.</p>
          </div>
        ))}
          </>
        )}
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      </div>

      {historyOpen ? (
        <div className="flex shrink-0 gap-2 border-t border-neutral-200 bg-white p-4 sm:p-5">
          <button
            type="button"
            disabled={switchingConversation || sending}
            onClick={() => void startNewChat()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
          >
            <Plus className="size-4" /> New chat
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            className="flex-1 rounded-xl bg-teal-800 px-4 py-3 text-sm font-bold text-white hover:bg-teal-900"
          >
            Back to chat
          </button>
        </div>
      ) : <form onSubmit={sendMessage} className="shrink-0 border-t border-neutral-200 bg-white p-4 sm:p-5">
        {!modelAvailable && (
          <p role="alert" className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Velona is not configured on the backend. Ask an administrator to set VELONA_API_KEY.
          </p>
        )}
        {activeAttachment && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-900">
            <span className="truncate">Image ready for {activeAttachment.type === "email" ? "email campaign" : "popup"}: {activeAttachment.url}</span>
            <button type="button" onClick={() => setAttachment(null)} className="shrink-0 font-bold underline">Remove</button>
          </div>
        )}
        {admin && (
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void uploadImage(event.target.files?.[0])}
          />
        )}
        <div className="flex items-end gap-2">
          {admin && (
            <div className="flex shrink-0 items-center gap-2">
              <select
                value={uploadDestination}
                onChange={(event) => setUploadType(event.target.value as "email" | "popup")}
                aria-label="Image destination"
                className="h-10 max-w-24 rounded-xl border border-neutral-300 bg-white px-1 text-[11px] sm:max-w-none sm:px-2 sm:text-xs"
              >
                {sectionContext.name !== "Popup campaigns" && <option value="email">Email banner</option>}
                {sectionContext.name !== "Email management" && <option value="popup">Popup image</option>}
              </select>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                aria-label="Upload campaign image"
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
              >
                {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              </button>
            </div>
          )}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={2}
            maxLength={4000}
            aria-label="Message the AI assistant"
            placeholder={admin ? "Describe a task for the admin assistant..." : "Ask about services, orders, or support..."}
            className="min-h-11 flex-1 resize-y rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
          />
          <button
            type="submit"
            disabled={sending || !text.trim() || !modelAvailable}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-800 text-white hover:bg-teal-900 disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-neutral-500">
          {admin && sectionContext.name === "Email management"
            ? "Tip: Share the email topic and schedule. I can draft the copy, match a festival or offer banner, and generate artwork if requested."
            : admin && sectionContext.name === "Popup campaigns"
              ? "Tip: Share the popup topic and display times. Request custom AI artwork whenever you need it."
              : admin
                ? "Tip: Describe an admin task or ask about the section you are viewing."
                : "Tip: Ask me to find a service, check a recent order, or get support."}
        </p>
      </form>}
    </section>
  );
}
