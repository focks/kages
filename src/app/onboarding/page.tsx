"use client";

// The setup guide: wire an AI agent up to Kages. Modelled as a tabbed, step-by-
// step checklist (Terminal/CLI vs Agent app/MCP) with per-step "mark done" that
// persists in localStorage, so progress survives a refresh and the guide can be
// revisited. Full-page and shell-free (outside the (app) group); "Skip" drops
// the user into the app. Readiness uses the operation API; checklist marks
// record review only and never stand in for an authenticated agent connection.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { onboardingTracks, type Step } from "@/onboarding/steps";

const DONE_KEY = "kages.onboarding.done.v2";

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
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-5 text-left">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[13px]", done ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>{done ? <Check className="size-4" /> : n}</span>
        <span className="flex-1 font-display text-[17px] font-[620] tracking-[-0.01em]">{step.title}{step.optional && <span className="ml-2 align-middle font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-muted-foreground">optional</span>}</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-5 pb-5 pl-[52px]">
          <p className="text-[15px] leading-relaxed text-muted-foreground">{step.blurb}</p>
          {step.href && <Link href={step.href} className="mt-3 inline-block text-wire underline">{step.linkLabel}</Link>}
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
  const [origin, setOrigin] = useState("https://app.getkages.com");
  const [connection, setConnection] = useState<{ready: boolean; mode: string; workspace: string | null} | null>(null);
  const [connectionError, setConnectionError] = useState("");
  async function checkConnection() {
    setConnectionError(""); setConnection(null);
    try { const r = await fetch("/api/get_setup", {method:"POST",headers:{"content-type":"application/json"},body:"{}"}); const data = await r.json(); if (!r.ok) throw new Error(data?.error?.msg || "Could not check workspace"); setConnection(data); }
    catch (e) { setConnectionError((e as Error).message); }
  }
  useEffect(() => { setOrigin(location.origin); void checkConnection(); }, []);
  const TRACKS = onboardingTracks(origin);
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
        <p className="text-center font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Account → workspace → agent → first Kage</p>
        <h1 className="mt-3 text-center font-display text-[34px] leading-[1.1] font-[680] tracking-[-0.02em] sm:text-[40px]">Get your agent building Kages</h1>
        <p className="mx-auto mt-4 max-w-lg text-center text-[15px] leading-relaxed text-muted-foreground">
          Kages is driven by your AI agent — Claude Code, Codex, Cursor, and anything else that speaks MCP. Sign in, verify the destination, and give your agent the authoring guidance it needs.
        </p>

        <section aria-label="Browser workspace status" className="mt-6 rounded-xl border bg-card p-4 text-sm">
          <p role="status">{connectionError || (!connection ? "Checking this browser’s workspace…" : connection.ready ? `Browser connected to ${connection.workspace} (${connection.mode}).` : "This browser is not signed in. Start with sign-in below.")}</p>
          <p className="mt-2 text-muted-foreground">This checks the browser only. Verify the agent separately with get_setup after connecting MCP.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void checkConnection()}>Recheck workspace</Button>
        </section>
        {/* Track switch */}
        <div className="mt-8 grid grid-cols-2 gap-1 rounded-xl border bg-card p-1">
          {TRACKS.map((t) => (
            <button key={t.id} type="button" aria-pressed={track === t.id} onClick={() => setTrack(t.id)}
              className={cn("rounded-lg py-2.5 text-sm font-medium transition-colors", track === t.id ? "bg-primary-soft text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div className="mt-5 flex items-center gap-3">
          <div role="progressbar" aria-label="Setup checklist reviewed" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={required.length} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(completed / required.length) * 100}%` }} />
          </div>
          <span className="font-mono text-xs text-muted-foreground">{completed}/{required.length} reviewed</span>
        </div>

        {/* Steps */}
        <div className="mt-6 space-y-4">
          {current.steps.map((s, i) => <StepCard key={s.id} step={s} n={i + 1} done={done.has(s.id)} onToggle={() => toggle(s.id)} />)}
        </div>

        {allDone && (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-primary/40 bg-primary-soft/30 p-6 text-center">
            <p className="font-display text-[17px] font-[620]">Checklist reviewed. Confirm the agent’s get_setup result and first Kage in your Library.</p>
            <Button render={<Link href="/artifacts" />} nativeButton={false}>Go to the app</Button>
          </div>
        )}
      </div>
    </main>
  );
}
