"use client";

import Link from "next/link";
import { KageRenderer } from "@/runtime/KageRenderer";
import { MadeWithKages } from "@/components/dashboard/made-with-kages";
import { cn } from "@/lib/utils";
import type { KageDoc } from "@/engine/types";
import type { NavGroup } from "@/docs/nav";

/** The one docs frame. Every page, including the interactive lesson, renders its title and intro as a Kage
 *  so headings look the same everywhere; `children` is whatever interactive part follows. */
export function DocsView({ nav, doc, current, editHref, children }: { nav: NavGroup[]; doc: KageDoc; current: string | null; editHref: string | null; children?: React.ReactNode }) {
  const link = "block rounded-md px-2 py-1.5 text-sm hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
  const item = (href: string, label: string, on: boolean) => <li key={href}><Link href={href} aria-current={on ? "page" : undefined} className={cn(link, on && "bg-primary-soft font-medium")}>{label}</Link></li>;
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Link href="/docs" className="font-display text-[15px] font-[650] tracking-[-0.01em]">Kages docs</Link>
        <span className="ml-auto" />
        <Link href="/artifacts" className="text-sm text-muted-foreground hover:text-foreground">Open the app</Link>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        <nav aria-label="Documentation" className="shrink-0 md:w-52">
          <ul className="mb-3">{item("/docs", "Overview", current === null)}</ul>
          {nav.map((g) => (
            <div key={g.group} className="mb-3">
              <div className="px-2 pb-1 font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{g.group}</div>
              <ul className="flex flex-wrap gap-1 md:block md:space-y-0.5">{g.items.map((n) => item(`/docs/${n.slug}`, n.title, current === n.slug))}</ul>
            </div>
          ))}
        </nav>
        <main className="min-w-0 flex-1">
          <KageRenderer key={doc.id} doc={doc} />
          {children && <div className="mt-6 rounded-xl border bg-card p-6">{children}</div>}
          {editHref && (
            <div className="mt-10 border-t pt-4 text-sm">
              <a href={editHref} target="_blank" rel="noreferrer" className="text-wire underline underline-offset-4 hover:text-foreground">Edit this page on GitHub</a>
            </div>
          )}
        </main>
      </div>
      <footer className="flex justify-center py-6"><MadeWithKages /></footer>
    </div>
  );
}
