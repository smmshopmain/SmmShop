"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client-api";

export function ProviderForm() {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await apiFetch("/api/admin/providers", {
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

export function ProviderEditForm({
  provider,
}: {
  provider: { _id: string; name: string; apiUrl: string; priority: number; enabled: boolean };
}) {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const apiKey = String(form.get("apiKey") ?? "").trim();
    const body: Record<string, unknown> = {
      id: provider._id,
      name: form.get("name"),
      apiUrl: form.get("apiUrl"),
      priority: Number(form.get("priority")),
      enabled: form.get("enabled") === "on",
    };
    if (apiKey) body.apiKey = apiKey;

    const response = await apiFetch("/api/admin/providers", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setMessage(response.ok ? "Provider updated." : result.message);
    if (response.ok) window.location.reload();
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 rounded-md bg-neutral-50 p-3 sm:grid-cols-[1fr_1fr_90px] md:col-span-5">
      <input
        name="name"
        defaultValue={provider.name}
        required
        className="rounded-md border border-neutral-300 px-2 py-2 text-xs"
      />
      <input
        name="apiUrl"
        type="url"
        defaultValue={provider.apiUrl}
        required
        className="rounded-md border border-neutral-300 px-2 py-2 text-xs"
      />
      <input
        name="priority"
        type="number"
        min={1}
        defaultValue={provider.priority}
        className="rounded-md border border-neutral-300 px-2 py-2 text-xs"
      />
      <input
        name="apiKey"
        placeholder="New API key"
        className="rounded-md border border-neutral-300 px-2 py-2 text-xs sm:col-span-2"
      />
      <label className="flex items-center gap-2 text-xs font-medium">
        <input name="enabled" type="checkbox" defaultChecked={provider.enabled} /> Enabled
      </label>
      <button className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white sm:col-span-3">
        Update provider
      </button>
      {message && <p className="text-xs text-neutral-500 sm:col-span-3">{message}</p>}
    </form>
  );
}
