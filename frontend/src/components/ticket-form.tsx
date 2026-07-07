"use client";

import { useState } from "react";
import { Send, Ticket } from "lucide-react";
import { apiFetch } from "@/lib/client-api";

export function TicketForm() {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await apiFetch("/api/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject: form.get("subject"),
        message: form.get("message"),
        priority: form.get("priority"),
      }),
    });
    await response.json().catch(() => ({}));
    setMessage(response.ok ? "Ticket created." : "Unable to create ticket right now. Please try again.");
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-800">
          <Ticket className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-neutral-950">Create ticket</h2>
          <p className="mt-1 text-sm text-neutral-600">Clearly describe your order, payment, or account issue.</p>
        </div>
      </div>
      <label className="grid gap-2 text-sm font-semibold text-neutral-800">
        Subject
        <input name="subject" placeholder="Short issue title" required className="h-11 rounded-md border border-neutral-300 px-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10" />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-neutral-800">
        Priority
        <select name="priority" defaultValue="Medium" className="h-11 rounded-md border border-neutral-300 px-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10">
        <option>Low</option>
        <option>Medium</option>
        <option>High</option>
      </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-neutral-800">
        Message
        <textarea name="message" placeholder="Write full details here" required rows={5} className="rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10" />
      </label>
      {message && <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">{message}</p>}
      <button className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800">
        <Send className="size-4" />
        Submit ticket
      </button>
    </form>
  );
}
