import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Terminal } from "./terminal";

// The public front door, served at getkages.com (the apex host rewrites `/` to
// this route — see the middleware). It renders OUTSIDE the (app) group so it has
// no sidebar chrome. Static but for one copy button (the Terminal client island).
// Terminal/monospace aesthetic: big headline + accent, a command block, a dense
// stats grid, thin grid-line dividers.

export const metadata = {
  title: "Kages — the cross-agent artifactory",
  description:
    "Make an artifact in one agent and edit it in any other. Kages is the provider-neutral store where every agent reads and writes the same versioned, signed artifact over MCP and REST.",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "/";
const GITHUB = "https://github.com/focks/kages";

// The data panel beside the hero — facts, not adjectives, in the px0 spirit.
const STATS: { value: string; label: string; sub: string }[] = [
  { value: "1", label: "Operation set", sub: "UI, CLI, MCP & REST all call it" },
  { value: "∞", label: "Agents", sub: "any model or provider, one artifact" },
  { value: "3", label: "Design systems", sub: "Core · Ledger · Atelier" },
  { value: "0", label: "Vendor lock-in", sub: "the store is neutral ground" },
  { value: "v+1", label: "Every save", sub: "a signed, immutable version" },
  { value: "/k/", label: "Share links", sub: "full-page render, no sign-in" },
];

// Feature sections: a numbered mono eyebrow, a big headline with an accent
// phrase, and one tight paragraph — read top to bottom like a spec.
const SECTIONS: { no: string; eyebrow: string; head: string; accent: string; body: string }[] = [
  {
    no: "01", eyebrow: "Portability",
    head: "One artifact.", accent: "Every agent.",
    body: "A page built in ChatGPT or Codex can’t be edited by Claude — each provider locks its artifacts to itself, and the best another can do is read a public copy. Kages is the neutral store in between: every agent, on any model or protocol, reads and writes the same artifact over one operation set.",
  },
  {
    no: "02", eyebrow: "Mechanism",
    head: "No HTML.", accent: "Just blocks.",
    body: "An artifact is JSON — blocks from a design system assembled against published contracts. Agents never write markup, so there’s no injection surface and the document travels between agents intact. The same portable file renders in Core, Ledger or Atelier.",
  },
  {
    no: "03", eyebrow: "Provenance",
    head: "Versioned, signed,", accent: "shareable.",
    body: "Every save is a new immutable version with full provenance — roll back, diff, or pin a version. Publish and share an opaque /k/<uuid> link and anyone sees a clean full-page render in the Kage’s own design system, no sign-in.",
  },
];

const mono = "font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground";

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div aria-hidden className="flex size-7 items-center justify-center rounded-sm bg-primary font-display text-[13px] font-bold tracking-[-0.03em] text-primary-foreground">Kg</div>
            <span className="font-mono text-[15px] font-medium">kages</span>
          </div>
          <nav className="flex items-center gap-1">
            <Button render={<a href="/docs" />} nativeButton={false} variant="ghost" size="sm" className="font-mono">docs</Button>
            <Button render={<a href={GITHUB} target="_blank" rel="noreferrer" />} nativeButton={false} variant="ghost" size="sm" className="font-mono">github</Button>
            <Button render={<Link href={APP_URL} />} nativeButton={false} size="sm" className="font-mono">open app</Button>
          </nav>
        </div>
      </header>

      {/* Tagline strip */}
      <div className="border-b border-border">
        <p className={`mx-auto w-full max-w-6xl px-6 py-2.5 ${mono}`}>
          The cross-agent artifactory — build an artifact in one agent, edit it in any other.
        </p>
      </div>

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.3fr_1fr] lg:py-24">
          <div>
            <h1 className="font-display text-[44px] leading-[1.02] font-[700] tracking-[-0.03em] sm:text-[60px]">
              Make an artifact in one agent.<br /><span className="text-primary">Edit it in any other.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
              Kages is the provider-neutral store where every agent — Claude, Codex, Cursor, anything that speaks MCP — reads and writes the same versioned, signed artifact. No vendor lock-in, full history, shareable by link.
            </p>
            <div className="mt-8"><Terminal lines={["npm install -g @ifocksh/kages", "claude mcp add kages -- kages mcp"]} /></div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button render={<Link href={APP_URL} />} nativeButton={false} size="lg" className="font-mono">open the app <ArrowRight className="size-4" /></Button>
              <Button render={<a href={GITHUB} target="_blank" rel="noreferrer" />} nativeButton={false} size="lg" variant="outline" className="font-mono">star on github</Button>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border self-start">
            {STATS.map((s) => (
              <div key={s.label} className="bg-background p-5">
                <div className="font-display text-[30px] leading-none font-[680] tracking-[-0.02em] tabular-nums text-primary">{s.value}</div>
                <div className="mt-3 font-mono text-[12px] font-medium uppercase tracking-[0.06em]">{s.label}</div>
                <div className="mt-1 text-[12px] leading-snug text-muted-foreground">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature sections */}
      {SECTIONS.map((s) => (
        <section key={s.no} className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-16 md:grid-cols-[180px_1fr]">
            <div className={mono}>{s.no} / {s.eyebrow}</div>
            <div className="max-w-2xl">
              <h2 className="font-display text-[30px] leading-[1.08] font-[680] tracking-[-0.02em] sm:text-[38px]">
                {s.head} <span className="text-primary">{s.accent}</span>
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          </div>
        </section>
      ))}

      {/* Install */}
      <section className="border-b border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-16 md:grid-cols-[180px_1fr]">
          <div className={mono}>04 / Start</div>
          <div className="max-w-2xl">
            <h2 className="font-display text-[30px] leading-[1.08] font-[680] tracking-[-0.02em] sm:text-[38px]">Wire up your agent.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">Install the CLI, register the MCP server, and your agent can build and publish Kages. The command stays <code className="font-mono text-[0.9em]">kages</code>.</p>
            <div className="mt-6"><Terminal lines={["npm install -g @ifocksh/kages", "claude mcp add kages -- kages mcp", "kages mcp info"]} /></div>
            <div className="mt-5"><Button render={<a href="/docs" />} nativeButton={false} variant="outline" size="sm" className="font-mono">read the docs <ArrowRight className="size-4" /></Button></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 font-mono text-[12px] text-muted-foreground sm:flex-row">
          <span>© kages · MIT</span>
          <div className="flex items-center gap-5">
            <a href="/docs" className="hover:text-foreground">docs</a>
            <a href={GITHUB} target="_blank" rel="noreferrer" className="hover:text-foreground">github</a>
            <Link href={APP_URL} className="hover:text-foreground">open app</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
