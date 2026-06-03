"use client";

import { useState } from "react";

export function ProviderForm() {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        apiUrl: form.get("apiUrl"),
        apiKey: form.get("apiKey"),
        priority: Number(form.get("priority")),
        enabled: form.get("enabled") === "on",
      }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Provider saved. Run service sync to import services." : result.message);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-md border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Add provider</h2>
      <input name="name" placeholder="Provider name" required className="rounded-md border border-neutral-300 px-3 py-2" />
      <input name="apiUrl" placeholder="API URL" type="url" required className="rounded-md border border-neutral-300 px-3 py-2" />
      <input name="apiKey" placeholder="API key" required className="rounded-md border border-neutral-300 px-3 py-2" />
      <input name="priority" placeholder="Priority" type="number" min={1} defaultValue={1} className="rounded-md border border-neutral-300 px-3 py-2" />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input name="enabled" type="checkbox" defaultChecked /> Enabled
      </label>
      {message && <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm">{message}</p>}
      <button className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white">Save provider</button>
    </form>
  );
}
