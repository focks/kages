"use client";

// The setup guide: wire an AI agent up to Kages. Modelled as a tabbed, step-by-
// step checklist (Terminal/CLI vs Agent app/MCP) with per-step "mark done" that
// persists in localStorage, so progress survives a refresh and the guide can be
// revisited. Full-page and shell-free (outside the (app) group); "Skip" drops
// the user into the app. No store calls — it only shows commands to run.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Step { id: string; title: string; optional?: boolean; blurb: string; code?: string; note?: string }
interface Track { id: string; label: string; steps: Step[] }

// The two ways an agent reaches Kages. The CLI track installs `kages` globally;
// the MCP track registers the server with no global install (npx fetches it).
const TRACKS: Track[] = [
  {
    id: "cli",
    label: "Terminal (CLI)",
    steps: [
      { id: "cli-install", title: "Install the CLI", blurb: "One-time, on the machine where your agent runs. Installs the Kages CLI and the authoring skills your agent uses.", code: "npm install -g @ifocksh/kages", note: "Node 18 or newer. The command is `kages`; verify with `kages --version`." },
      { id: "cli-mcp", title: "Connect your agent", blurb: "Register the Kages MCP server so your agent can build and publish Kages. For Codex, swap the command for `codex mcp add`.", code: "claude mcp add kages -- kages mcp", note: "Or run `kages install` to wire every coding tool it finds (Claude Code, Cursor, Codex, Copilot)." },
      { id: "cli-try", title: "Try it end-to-end", optional: true, blurb: "Paste this into your agent. It builds a Kage, publishes it, and hands you a share link.", code: "Build a Kage: a one-page \"new-hire onboarding checklist\" with sections and checkboxes. Publish it and give me the share link." },
    ],
  },
  {
    id: "mcp",
    label: "Agent app (MCP)",
    steps: [
      { id: "mcp-add", title: "Add the Kages MCP server", blurb: "No global install needed — npx fetches it. For Codex, swap in `codex mcp add`.", code: "claude mcp add kages -- npx -y @ifocksh/kages mcp", note: "The server exposes the full operation set as tools and the authoring skills as prompts." },
      { id: "mcp-cloud", title: "Use your cloud workspace", optional: true, blurb: "By default the server acts on a local workspace. Sign in to act on your hosted workspace instead.", code: "kages mcp login --url https://app.getkages.com" },
      { id: "mcp-try", title: "Try it end-to-end", optional: true, blurb: "Ask your agent to build something. It assembles the Kage from blocks and publishes it.", code: "Build a Kage: a one-page \"new-hire onboarding checklist\" with sections and checkboxes. Publish it and give me the share link." },
    ],
  },
];

const DONE_KEY = "kages.onboarding.done";

function CodeBlock({ code }: { code: string }) {
  async function copy() {
    try { await navigator.clipboard.writeText(code); toast.success("Copied"); }
    catch { toast.error("Couldn’t copy"); }
  }
  return (
    <div className="group relative mt-3">
      <pre className="overflow-x-auto rounded-lg border border-border bg-foreground/[0.04] p-4 pr-12 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">{code}</pre>
      <Button size="icon-sm" variant="ghost" aria-label="Copy" onClick={copy} className="absolute right-2 top-2"><Copy /></Button>
    </div>
  );
}

function StepCard({ step, n, done, onToggle }: { step: Step; n: number; done: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={cn("rounded-xl border bg-card transition-colors", done && "border-primary/40 bg-primary-soft/30")}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-5 text-left">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[13px]", done ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>{done ? <Check className="size-4" /> : n}</span>
        <span className="flex-1 font-display text-[17px] font-[620] tracking-[-0.01em]">{step.title}{step.optional && <span className="ml-2 align-middle font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-muted-foreground">optional</span>}</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-5 pb-5 pl-[52px]">
          <p className="text-[15px] leading-relaxed text-muted-foreground">{step.blurb}</p>
          {step.code && <CodeBlock code={step.code} />}
          {step.note && <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{step.note}</p>}
          <div className="mt-4 flex justify-end">
            <Button size="sm" variant={done ? "outline" : "default"} onClick={onToggle}>
              {done ? "Done" : <><Check className="size-4" /> Mark done</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const [track, setTrack] = useState("cli");
  const [done, setDone] = useState<Set<string>>(new Set());
  // Load/save completion so progress survives a refresh or a return visit.
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]"); if (Array.isArray(v)) setDone(new Set(v.filter((x) => typeof x === "string"))); } catch { /* no storage: progress lasts the session */ } }, []);
  const toggle = (id: string) => setDone((prev) => {
    const next = new Set(prev); if (!next.delete(id)) next.add(id);
    try { localStorage.setItem(DONE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
    return next;
  });

  const current = TRACKS.find((t) => t.id === track)!;
  const required = current.steps.filter((s) => !s.optional);
  const completed = required.filter((s) => done.has(s.id)).length;
  const allDone = completed === required.length;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="flex justify-end p-4">
        <Button render={<Link href="/" />} nativeButton={false} variant="ghost" size="sm" className="text-muted-foreground">Skip tutorial <X className="size-4" /></Button>
      </div>

      <div className="mx-auto w-full max-w-2xl px-6 pb-24">
        <p className="text-center font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Setup guide · about 2 minutes</p>
        <h1 className="mt-3 text-center font-display text-[34px] leading-[1.1] font-[680] tracking-[-0.02em] sm:text-[40px]">Get your agent building Kages</h1>
        <p className="mx-auto mt-4 max-w-lg text-center text-[15px] leading-relaxed text-muted-foreground">
          Kages is driven by your AI agent — Claude Code, Codex, Cursor, and anything else that speaks MCP. These steps wire it up.
        </p>

        {/* Track switch */}
        <div className="mt-8 grid grid-cols-2 gap-1 rounded-xl border bg-card p-1">
          {TRACKS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTrack(t.id)}
              className={cn("rounded-lg py-2.5 text-sm font-medium transition-colors", track === t.id ? "bg-primary-soft text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(completed / required.length) * 100}%` }} />
          </div>
          <span className="font-mono text-xs text-muted-foreground">{completed}/{required.length} complete</span>
        </div>

        {/* Steps */}
        <div className="mt-6 space-y-4">
          {current.steps.map((s, i) => <StepCard key={s.id} step={s} n={i + 1} done={done.has(s.id)} onToggle={() => toggle(s.id)} />)}
        </div>

        {allDone && (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-primary/40 bg-primary-soft/30 p-6 text-center">
            <p className="font-display text-[17px] font-[620]">You’re wired up. Your agent can build Kages now.</p>
            <Button render={<Link href="/artifacts" />} nativeButton={false}>Go to the app</Button>
          </div>
        )}
      </div>
    </main>
  );
}
