"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bot, Check, ImagePlus, LoaderCircle, Send, Sparkles } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/client-api";

type ChatMessage = { role: "user" | "assistant"; content: string };
type PendingAction = { id: string; name: string; summary: string };

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
        ["/admin/email", "Email management", "Review campaign status or draft an announcement."],
        ["/admin/popups", "Popup campaigns", "Review popup schedules or draft a campaign."],
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
        ["/dashboard/tickets", "Support", "Get help or prepare a support request."],
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

  useEffect(() => {
    if (!active) return;
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
        const result = await apiJson("/api/ai/assistant/history", { cache: "no-store" });
        if (!result?.ok) throw new Error(result?.message || "Unable to load your conversation history.");
        if (mounted) setMessages(parseChatHistory(result.messages));
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

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const content = attachment
      ? `${trimmed}\n\nUploaded ${attachment.type === "email" ? "email campaign banner" : "website popup image"} URL: ${attachment.url}`
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
          pageContext: { path: pathname },
        }),
      });
      if (!result?.ok) throw new Error(result?.message || "Unable to get an AI response.");
      setMessages((current) => [...current, { role: "assistant", content: result.message }]);
      setPendingActions((current) => [
        ...current,
        ...(Array.isArray(result.pendingActions) ? result.pendingActions : []),
      ]);
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
        }),
      });
      if (!result?.ok) throw new Error(result?.message || "Unable to approve this action.");
      setPendingActions((current) => current.filter((item) => item.id !== action.id));
      setMessages((current) => [...current, { role: "assistant", content: result.message }]);
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
        }),
      });
      if (!result?.ok) throw new Error(result?.message || "Unable to cancel this action.");
      setPendingActions((current) => current.filter((item) => item.id !== action.id));
      setMessages((current) => [...current, { role: "assistant", content: result.message }]);
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
      const endpoint = uploadType === "email" ? "/api/admin/campaign-banner" : "/api/admin/site-popup-image";
      const response = await apiFetch(endpoint, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok || !result?.ok || !result?.data?.url) {
        throw new Error(result?.message || "Unable to upload this image.");
      }
      setAttachment({ url: result.data.url, type: uploadType });
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

  return (
    <section className={`mx-auto flex w-full flex-col overflow-hidden border border-neutral-200 bg-white shadow-sm ${compact ? "h-full rounded-2xl" : "max-w-4xl rounded-3xl"}`}>
      <header className={`shrink-0 border-b border-neutral-200 bg-gradient-to-br from-teal-950 to-slate-900 text-white ${compact ? "px-4 py-4" : "px-5 py-5 sm:px-7"}`}>
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10"><Sparkles className="size-5 text-teal-200" /></span>
          <div>
            <h2 className="text-lg font-bold">{admin ? "Admin AI assistant" : "Your AI assistant"}</h2>
            <p className="mt-1 text-xs text-teal-100/80">
              {sectionContext.name} · {admin
                ? "Section-aware workspace help and controlled operations."
                : "Help tailored to the section you are viewing."}
            </p>
          </div>
        </div>
      </header>

      <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto bg-neutral-50/70 px-4 py-5 sm:px-7 ${compact ? "" : "min-h-72"}`}>
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
        {messages.map((message, index) => (
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
        ))}
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
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      </div>

      <form onSubmit={sendMessage} className="shrink-0 border-t border-neutral-200 bg-white p-4 sm:p-5">
        {!modelAvailable && (
          <p role="alert" className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Velona is not configured on the backend. Ask an administrator to set VELONA_API_KEY.
          </p>
        )}
        {attachment && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-900">
            <span className="truncate">Image ready for {attachment.type === "email" ? "email campaign" : "popup"}: {attachment.url}</span>
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
                value={uploadType}
                onChange={(event) => setUploadType(event.target.value as "email" | "popup")}
                aria-label="Image destination"
                className="h-10 max-w-24 rounded-xl border border-neutral-300 bg-white px-1 text-[11px] sm:max-w-none sm:px-2 sm:text-xs"
              >
                <option value="email">Email banner</option>
                <option value="popup">Popup image</option>
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
          {admin
            ? "This conversation is saved to your admin account. Email delivery and popup publishing follow the configured approval policy. Messages are sent to Velona; do not include passwords, API keys, OTPs, or payment credentials."
            : "This conversation is saved to your account, and recent messages help your assistant remember context. Messages and relevant order details are sent to Velona. Your assistant only accesses your own orders and the public service catalog; never share passwords, OTPs, or payment credentials. Orders must still be placed through the order form."}
        </p>
      </form>
    </section>
  );
}
