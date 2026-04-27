"use client";

import { useState } from "react";

export function CopyLinkButton({ tripId }: { tripId: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      const href = `${window.location.origin}/trip/${tripId}`;
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:opacity-90"
    >
      {copied ? "Link Copied!" : "Copy Link"}
    </button>
  );
}
