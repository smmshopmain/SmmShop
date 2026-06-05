"use client";

import { useState } from "react";
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
    const result = await response.json();
    setMessage(response.ok ? "Ticket created." : result.message);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-md border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Create ticket</h2>
      <input name="subject" placeholder="Subject" required className="rounded-md border border-neutral-300 px-3 py-2" />
      <select name="priority" defaultValue="Medium" className="rounded-md border border-neutral-300 px-3 py-2">
        <option>Low</option>
        <option>Medium</option>
        <option>High</option>
      </select>
      <textarea name="message" placeholder="Message" required rows={5} className="rounded-md border border-neutral-300 px-3 py-2" />
      {message && <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm">{message}</p>}
      <button className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white">Submit ticket</button>
    </form>
  );
}
