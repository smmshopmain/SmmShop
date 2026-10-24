"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client-api";

export function GoogleAuthSettings({
  enabled,
  configured,
}: {
  enabled: boolean;
  configured: boolean;
}) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "auth", value: { googleEnabled: isEnabled } }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "Unable to save Google sign-in settings.");
        return;
      }
      setMessage("Google sign-in setting saved.");
    } catch {
      setMessage("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 rounded-md border border-neutral-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Google sign-in</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Allow users to create an account or sign in with a verified Google email. Google-created accounts do not require a mobile number.
        </p>
      </div>
      <div className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-700">
        {configured
          ? "Google OAuth credentials are configured on the backend."
          : "Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and APP_BASE_URL to the backend environment before enabling this option."}
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(event) => setIsEnabled(event.target.checked)}
          disabled={!configured && !isEnabled}
          className="size-4 rounded border-neutral-300"
        />
        <span>Enable Google sign-in on registration and login</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading || (!configured && isEnabled !== enabled)}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save Google setting"}
        </button>
        {message && <p role="status" className="text-sm text-neutral-600">{message}</p>}
      </div>
    </form>
  );
}
