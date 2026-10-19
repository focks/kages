"use client";

// "Are you an agent?": agent instructions — install and how-to instructions for the CLI, MCP and REST, tucked in a slim
// native <details> so they stay out of the reading view until someone wants them. Chrome-token
// styled and outside the Kage's own design-system scope. Native <details> gives keyboard and
// screen-reader behaviour for free and needs no state.

import { useEffect, useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { agentPrompt, usageGroups } from "./kage-usage-model.ts";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy command"
      className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked: the text is still selectable */ } }}
    >
      {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

export function KageUsage({ name, uuid, className }: { name: string; uuid?: string; className?: string }) {
  // The origin is known only in the browser; render nothing until then so server and client agree.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  if (!origin) return null;
  const groups = usageGroups({ origin, name, uuid });
  return (
    <details className={`group w-full border-t bg-background text-sm ${className ?? ""}`}>
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 px-4 py-1.5 text-xs text-muted-foreground/70 hover:text-foreground [&::-webkit-details-marker]:hidden">
        <Terminal className="size-3" aria-hidden />
        <span>Are you an agent?</span>
        <span className="transition-transform group-open:rotate-90" aria-hidden>›</span>
      </summary>
      <div className="mx-auto max-h-[45svh] max-w-3xl space-y-5 overflow-auto px-4 pb-16 pt-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <p><span className="font-semibold text-foreground">Agent instructions for Kages.</span> Install the CLI, fetch this Kage, or connect over MCP or REST.</p>
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-foreground">Copy a prompt for your agent<CopyButton text={agentPrompt({ origin, name, uuid })} /></span>
          {uuid && <a className="underline underline-offset-2 hover:text-foreground" href={`/k/${uuid}.md`}>View as markdown</a>}
        </div>
        {groups.map((g) => (
          <section key={g.id} aria-labelledby={`kage-usage-${g.id}`}>
            <h3 id={`kage-usage-${g.id}`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h3>
            <ul className="space-y-2.5">
              {g.steps.map((s) => (
                <li key={s.label}>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="mt-1 flex items-start gap-1 rounded-md bg-muted px-2.5 py-1.5">
                    <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs">{s.command}</code>
                    <CopyButton text={s.command} />
                  </div>
                  {s.note && <div className="mt-1 text-xs text-muted-foreground">{s.note}</div>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
