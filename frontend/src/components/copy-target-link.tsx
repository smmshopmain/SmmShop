"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyTargetLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setError("");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Unable to copy link. Please copy it manually.");
    }
  }

  return (
    <div className="mt-1 min-w-0">
      <div className="flex min-w-0 items-start gap-2">
        <p data-copy-allowed className="min-w-0 flex-1 break-all text-xs text-neutral-500">{link}</p>
        <button
          type="button"
          onClick={() => void copyLink()}
          aria-label="Copy target link"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
