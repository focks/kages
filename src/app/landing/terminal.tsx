"use client";

// The hero's terminal block, split out as a client island so the landing page
// itself stays a server component (and keeps its `metadata` export). Copies all
// lines at once — the one bit of interactivity the otherwise-static page needs.

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function Terminal({ lines, label = "terminal", prompt = "$ " }: { lines: string[]; label?: string; prompt?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(lines.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: the text is visible to select */ }
  }
  return (
    <div className="rounded-md border border-border bg-foreground/[0.03] font-mono text-[13px]">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        <span>{label}</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
          {copied ? <><Check className="size-3" /> copied</> : <><Copy className="size-3" /> copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 leading-relaxed">{lines.map((l, i) => (
        <div key={i}><span className="select-none text-primary">{prompt}</span>{l}</div>
      ))}</pre>
    </div>
  );
}
