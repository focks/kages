import Link from "next/link";
import {
  ArrowRight, Blocks, GitBranch, Share2, Bot, Palette, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// The public front door, served at getkages.com (the apex host rewrites `/` to
// this route — see vercel.json). It renders OUTSIDE the (app) group so it has no
// sidebar chrome. Everything is static: no store calls, no client state.

export const metadata = {
  title: "Kages — the cross-agent artifactory",
  description:
    "Make an artifact in one agent and edit it in any other. Kages is the provider-neutral store where every agent reads and writes the same versioned, signed artifact over MCP and REST.",
};

// The running dashboard. In production it lives on app.getkages.com; locally
// (no subdomain) `/` is the dashboard, so default there. One env var, one default.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "/";

const FEATURES = [
  { icon: Bot, title: "Provider-neutral", body: "Create in Codex or ChatGPT, edit in Claude, review in Cursor — the same artifact, not a copy. One operation set over MCP and REST, so no provider owns it." },
  { icon: GitBranch, title: "Versioned & signed", body: "Every save is a new immutable version with full provenance. Roll back, diff, or pin a version to a share link." },
  { icon: Blocks, title: "Portable, not HTML", body: "An artifact is JSON: blocks from a design system against published contracts. It travels between agents intact — no markup, no injection surface." },
  { icon: Palette, title: "Three design systems", body: "The same portable document renders in Core, Ledger or Atelier. The system is chosen at creation and fixed after." },
  { icon: Share2, title: "Share by link", body: "Publish a Kage and share an opaque /k/<uuid> link. Anyone with it sees a clean full-page render in the Kage's own system." },
  { icon: ShieldCheck, title: "Self-hostable", body: "Run it in-memory with no login, or wire up Postgres/Supabase and Google sign-in with per-user workspaces." },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* Nav */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div aria-hidden className="flex size-8 items-center justify-center rounded-md bg-primary font-display text-[15px] font-bold tracking-[-0.03em] text-primary-foreground">Kg</div>
          <span className="font-display text-[17px] font-[650]">Kages</span>
        </div>
        <nav className="flex items-center gap-1">
          <Button render={<a href="/docs" />} nativeButton={false} variant="ghost" size="sm">Docs</Button>
          <Button render={<a href="https://github.com/focks/kages" target="_blank" rel="noreferrer" />} nativeButton={false} variant="ghost" size="sm">GitHub</Button>
          <Button render={<Link href={APP_URL} />} nativeButton={false} size="sm">Open app</Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <p className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-primary">The cross-agent artifactory</p>
        <h1 className="mt-4 max-w-3xl font-display text-[40px] leading-[1.05] font-[680] tracking-[-0.02em] sm:text-[56px]">
          Make an artifact in one agent. Edit it in any other.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          A page built in ChatGPT or Codex can’t be edited by Claude — each provider locks its
          artifacts to itself, and the best another can do is read a public copy. Kages is the
          neutral store in between: every agent, on any model or protocol, reads and writes the
          same versioned, signed artifact through one operation set over MCP and REST. No vendor
          lock-in, full history, shareable by link.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button render={<Link href={APP_URL} />} nativeButton={false} size="lg">Open the app <ArrowRight className="size-4" /></Button>
          <Button render={<a href="/docs" />} nativeButton={false} size="lg" variant="outline">Read the docs</Button>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-card/40">
        <div className="mx-auto grid w-full max-w-5xl gap-px overflow-hidden px-6 py-16 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="p-6">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-4 font-display text-[17px] font-[620] tracking-[-0.01em]">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick start */}
      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <h2 className="font-display text-[28px] font-[650] tracking-[-0.01em]">Run it in a minute</h2>
        <p className="mt-2 max-w-xl text-muted-foreground">In-memory, no login. Then open the docs or drive it from the terminal.</p>
        <pre className="mt-6 overflow-x-auto rounded-lg border border-border bg-foreground/[0.04] p-5 font-mono text-[13px] leading-relaxed">
{`git clone https://github.com/focks/kages.git && cd kages
npm ci
npm run dev        # http://localhost:3000`}
        </pre>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <span>© Kages · MIT licensed</span>
          <div className="flex items-center gap-5">
            <a href="/docs" className="hover:text-foreground">Docs</a>
            <a href="https://github.com/focks/kages" target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
            <Link href={APP_URL} className="hover:text-foreground">Open app</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
