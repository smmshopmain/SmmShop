"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, ImagePlus, LoaderCircle, Send, Sparkles } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/client-api";

type ChatMessage = { role: "user" | "assistant"; content: string };
type PendingAction = { id: string; name: string; summary: string };

export function AIAssistantWorkspace({ admin }: { admin: boolean }) {
  const router = useRouter();
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

  useEffect(() => {
    let active = true;
    const refreshStatus = () => {
      void apiJson("/api/ai/assistant", { cache: "no-store" })
        .then((result) => {
          if (!active) return;
          if (!result?.ok || !result.enabled) {
            router.replace(admin ? "/admin/settings" : "/dashboard");
            return;
          }
          setEnabled(true);
          setModelAvailable(result.modelAvailable !== false);
        })
        .catch(() => {
          if (active) router.replace(admin ? "/admin/settings" : "/dashboard");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    refreshStatus();
    const interval = window.setInterval(refreshStatus, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [admin, router]);

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
        body: JSON.stringify({ messages: nextMessages.slice(-12) }),
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
          messages: [{ role: "user", content: "Approve the pending action." }],
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
          messages: [{ role: "user", content: "Cancel the pending action." }],
          rejectActionId: action.id,
        }),
      });
      if (!result?.ok) throw new Error(result?.message || "Unable to cancel this action.");
      setPendingActions((current) => current.filter((item) => item.id !== action.id));
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

  if (loading || !enabled) {
    return <div className="grid min-h-56 place-items-center"><LoaderCircle className="size-6 animate-spin text-teal-700" /></div>;
  }

  return (
    <section className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <header className="border-b border-neutral-200 bg-gradient-to-br from-teal-950 to-slate-900 px-5 py-5 text-white sm:px-7">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/10"><Sparkles className="size-5 text-teal-200" /></span>
          <div>
            <h2 className="text-lg font-bold">{admin ? "Admin AI assistant" : "Your AI assistant"}</h2>
            <p className="mt-1 text-xs text-teal-100/80">
              {admin
                ? "Campaign drafts, scheduled popups, website appearance, and workspace overview."
                : "Search services, check your recent orders, or get help from support."}
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-72 space-y-4 bg-neutral-50/70 px-4 py-5 sm:px-7">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-5 text-sm leading-6 text-neutral-600">
            <p className="flex items-center gap-2 font-semibold text-neutral-900"><Bot className="size-4 text-teal-700" />How can I help?</p>
            <p className="mt-2">{admin
              ? "Try “Show me the admin overview”, “Create an announcement email for tomorrow at 10 AM”, or “Set the website design to Pulse”."
              : "Try “Find Instagram services”, “Show my latest orders”, or “Help me create a support ticket about a payment”."}</p>
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

      <form onSubmit={sendMessage} className="border-t border-neutral-200 bg-white p-4 sm:p-5">
        {!modelAvailable && (
          <p role="alert" className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            OpenAI is not configured on the backend. Ask an administrator to set OPENAI_API_KEY.
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
            ? "Email delivery and popup publishing follow the configured approval policy. Messages are sent to OpenAI; do not include passwords, API keys, OTPs, or payment credentials."
            : "Messages and relevant order details are sent to OpenAI. Your assistant only accesses your own orders and the public service catalog; never share passwords, OTPs, or payment credentials. Orders must still be placed through the order form."}
        </p>
      </form>
    </section>
  );
}
