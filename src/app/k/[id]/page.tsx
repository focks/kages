"use client";

// The shareable published-Kage link: /k/<uuid>. The path is the Kage's opaque
// uuid (not its name slug), so the link doesn't reveal the identity and isn't
// guessable. Access is the store's call: get_shared_kage returns the document
// only if the caller may read it (published link/public, or a repo grant), so a
// private Kage's link 404s for an outsider. The Kage renders in its OWN design
// system — the system is fixed at creation and not swappable here.

import { use, useEffect, useState, useRef } from "react";
import { CommentStage } from "@/components/dashboard/comments/comment-stage";
import { useGuestComments } from "@/components/dashboard/comments/use-guest-comments";
import { ShareFeedback } from "@/components/dashboard/share-feedback";
import { KageUsage } from "@/components/dashboard/kage-usage";
import { MadeWithKages } from "@/components/dashboard/made-with-kages";
import type { KageDoc, Json } from "@/engine/types";
import { PublishedActions } from "@/components/dashboard/published-actions";
import { KageRenderer } from "@/runtime/SandboxedKage";
import { DataSessionNotice } from "@/components/dashboard/data-session-notice";

export default function SharedKagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [doc, setDoc] = useState<KageDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const guest = useGuestComments(id);
  const readerState = useRef<Record<string, Json> | undefined>(undefined);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [printView, setPrintView] = useState(false), [printReady, setPrintReady] = useState(false);
  const [printTooTall, setPrintTooTall] = useState(false);

  // Read through the dedicated public route (resolves across workspaces), not the
  // per-workspace operation dispatcher.
  useEffect(() => {
    readerState.current = undefined;
    setPrintView(new URL(location.href).searchParams.get("print") === "1");
    fetch(`/api/shared/${encodeURIComponent(id)}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d?.error?.msg || r.statusText); return d as KageDoc; })
      .then((d) => setDoc(d))
      .catch((e) => setErr(String((e as Error).message || e)));
  }, [id]);

  if (err) {
    return (
      <div className="grid min-h-svh place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-lg font-[650]">This Kage isn’t available</h1>
          <p className="mt-1 text-sm text-muted-foreground">{err} — the link may be private or no longer shared.</p>
        </div>
      </div>
    );
  }
  if (!doc) return <div className="grid min-h-svh place-items-center p-6 text-sm text-muted-foreground">Loading…</div>;

  if (printView) return <div className="bg-background">
    <div className="flex flex-wrap items-center gap-3 border-b p-4 print:hidden">
      <a className="text-sm text-wire underline" href={`/k/${id}`}>Back to interactive Kage</a>
      <span className="flex-1 text-sm text-muted-foreground">Published starting view. Save as PDF in your browser’s print dialog; enable background graphics to preserve the colors.</span>
      <button className="rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50" disabled={!printReady || printTooTall} onClick={() => window.print()}>Print / save PDF</button>
    </div>
    {printTooTall && <p role="alert" className="p-4 text-sm">This document exceeds the print view’s 12,000px limit. Split it into shorter Kages before printing to avoid cutting off content.</p>}
    <KageRenderer doc={doc} dark={false} onReady={() => setPrintReady(true)} onMetrics={metrics => setPrintTooTall(metrics.scrollHeight > 12000)} />
  </div>;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background">
      <link rel="alternate" type="text/markdown" href={`/k/${id}.md`} />
      {/* One bar: the title on the left, the comment toggle on the right. The design system and version are machine detail, so they live in the tooltip, not the chrome. */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <span title={doc.system} className="min-w-0 flex-1 truncate font-display text-[15px] font-[650] tracking-[-0.01em]">{doc.title}</span>
        <PublishedActions doc={doc} uuid={id} readerState={() => readerState.current} />
        <div ref={setSlot} className="flex shrink-0 items-center gap-1" />
      </header>
      {/* Comment mode for visitors: click anything and a comment window opens there. They can only add notes. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <CommentStage doc={doc} api={guest} toolbarSlot={slot} className="min-h-0 flex-1" fill navigation onState={state => { readerState.current = state; }} />
      </div>
      <div className="shrink-0"><DataSessionNotice doc={doc} /><KageUsage name={doc.id} uuid={id} /></div>
      <ShareFeedback uuid={id} doc={doc} />
      <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center">
        <div className="pointer-events-auto"><MadeWithKages /></div>
      </div>
    </div>
  );
}
