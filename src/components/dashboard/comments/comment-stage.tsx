"use client";

// Comment mode over a rendered Kage, in the manner of a design tool: switch it on,
// click anywhere, type, post — and the note is pinned to that exact spot. The pin
// is stored as the *innermost real block* under the pointer plus the click as
// 0..1 fractions of that block's box, so it follows the block through resizes and
// responsive layout instead of drifting like a pixel offset would. Pins are drawn
// in an overlay inside the scrolling content, so they scroll with the page.
//
// While comment mode is on a transparent layer swallows clicks, so the Kage does
// not react to them. Keyboard users comment through the Discussion tab's "About"
// picker; this surface is the pointer route. See oracle/comments.feature.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, EyeOff, MessageSquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KageRenderer } from "@/runtime/KageRenderer";
import type { KageDoc } from "@/engine/types";
import { CommentNode, Composer } from "./comment-thread";
import { buildThreads, discussionStats, fractionIn, pinNumbers, popoverPlacement, shortName, visiblePins } from "./comment-model";
import type { CommentsApi } from "./use-comments";

interface Rect { left: number; top: number; width: number; height: number }
const POP = { width: 340, height: 280 };
const cssEscape = (s: string) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, "\\$&"));

/** A block's wrapper uses `display: contents` (no box of its own), so its rect is
 *  the union of its children's. Returns null for a block that renders nothing. */
function rectOf(el: Element, depth = 0): Rect | null {
  const r = el.getBoundingClientRect();
  if (r.width > 0 || r.height > 0) return { left: r.left, top: r.top, width: r.width, height: r.height };
  if (depth > 4) return null;
  let l = Infinity, t = Infinity, rr = -Infinity, b = -Infinity;
  for (const child of Array.from(el.children)) {
    const cr = rectOf(child, depth + 1);
    if (!cr) continue;
    l = Math.min(l, cr.left); t = Math.min(t, cr.top); rr = Math.max(rr, cr.left + cr.width); b = Math.max(b, cr.top + cr.height);
  }
  return Number.isFinite(l) ? { left: l, top: t, width: rr - l, height: b - t } : null;
}

export function CommentStage({ doc, api, className, flash }: { doc: KageDoc; api: CommentsApi; className?: string; flash?: { block: string; nonce: number } | null }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pinsRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ block: string; pos: { x: number; y: number }; at: { x: number; y: number } } | null>(null);
  const [hover, setHover] = useState<Rect | null>(null);
  const [flashRect, setFlashRect] = useState<Rect | null>(null);
  const [layout, setLayout] = useState<{ pins: Record<string, { x: number; y: number }>; width: number; height: number }>({ pins: {}, width: 0, height: 0 });
  const layoutKey = useRef("");

  const blockIds = useMemo(() => new Set(Object.keys(doc.blocks)), [doc]);
  const pins = useMemo(() => visiblePins(api.comments, blockIds, showResolved), [api.comments, blockIds, showResolved]);
  const numbers = useMemo(() => pinNumbers(api.comments), [api.comments]);
  const stats = discussionStats(api.comments);

  const toStage = useCallback((r: Rect): Rect => {
    const s = stageRef.current!.getBoundingClientRect();
    return { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height };
  }, []);

  /** Where every visible pin sits, in the stage's own coordinates. */
  const measure = useCallback(() => {
    const stage = stageRef.current, content = contentRef.current;
    if (!stage || !content) return;
    const sr = stage.getBoundingClientRect(), next: Record<string, { x: number; y: number }> = {};
    for (const p of pins) {
      const el = content.querySelector(`[data-block="${cssEscape(p.block)}"]`);
      const r = el && rectOf(el);
      if (!r || !p.pos) continue; // a block that is hidden right now simply has no pin on the page
      next[p.id] = { x: Math.round((r.left - sr.left + p.pos.x * r.width) * 10) / 10, y: Math.round((r.top - sr.top + p.pos.y * r.height) * 10) / 10 };
    }
    const key = JSON.stringify([next, Math.round(sr.width), Math.round(sr.height)]);
    if (key === layoutKey.current) return; // unchanged: do not re-render (the observers below would loop)
    layoutKey.current = key;
    setLayout({ pins: next, width: sr.width, height: sr.height });
  }, [pins]);

  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    const stage = stageRef.current, content = contentRef.current;
    if (!stage || !content) return;
    let raf = 0;
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    const ro = new ResizeObserver(schedule); ro.observe(stage);
    // The renderer loads its design system asynchronously and re-renders on every
    // interaction; watching only the content subtree (not our overlay) keeps pins
    // glued to their blocks without observing our own updates.
    const mo = new MutationObserver(schedule); mo.observe(content, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); window.removeEventListener("resize", schedule); };
  }, [measure]);

  // A jump from the Discussion tab ("@block") flashes that block for a moment.
  useEffect(() => {
    if (!flash || !contentRef.current) return;
    const el = contentRef.current.querySelector(`[data-block="${cssEscape(flash.block)}"]`);
    const r = el && rectOf(el);
    if (!r) return;
    (el as HTMLElement).scrollIntoView?.({ block: "center", behavior: "smooth" });
    const t0 = setTimeout(() => { const r2 = rectOf(el); if (r2 && stageRef.current) setFlashRect(toStage(r2)); }, 250);
    const t1 = setTimeout(() => setFlashRect(null), 2200);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, [flash, toStage]);

  /** The innermost block under a point that exists in the stored document (a
   *  repeated item's runtime instance id does not, so we climb to its template). */
  const hit = useCallback((cx: number, cy: number): { id: string; rect: Rect } | null => {
    const content = contentRef.current;
    if (!content) return null;
    for (const el of document.elementsFromPoint(cx, cy)) {
      if (overlayRef.current?.contains(el) || pinsRef.current?.contains(el) || popRef.current?.contains(el)) continue;
      let b = (el as HTMLElement).closest?.("[data-block]") as HTMLElement | null;
      while (b && content.contains(b)) {
        const id = b.getAttribute("data-block")!, rect = doc.blocks[id] ? rectOf(b) : null;
        if (rect) return { id, rect };
        b = b.parentElement?.closest("[data-block]") as HTMLElement | null;
      }
    }
    const root = content.querySelector(`[data-block="${cssEscape(doc.root)}"]`), rect = root && rectOf(root);
    return rect ? { id: doc.root, rect } : null;
  }, [doc]);

  // Esc peels back one layer at a time (draft → open thread → comment mode) and
  // only then lets the surrounding panel close. Capture phase, so we run before
  // the sheet's own dismiss handler and can stop it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (e.key === "Escape" && (draft || activeId || mode)) {
        e.stopPropagation(); e.preventDefault();
        if (draft) setDraft(null); else if (activeId) setActiveId(null); else setMode(false);
      } else if ((e.key === "c" || e.key === "C") && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setMode((m) => !m); setDraft(null); setActiveId(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [draft, activeId, mode]);

  // Clicking away from an open thread closes it.
  useEffect(() => {
    if (!activeId) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || pinsRef.current?.contains(t)) return;
      setActiveId(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [activeId]);

  function onOverlayMove(e: React.MouseEvent) {
    const h = hit(e.clientX, e.clientY);
    setHover(h ? toStage(h.rect) : null);
  }
  function onOverlayClick(e: React.MouseEvent) {
    const h = hit(e.clientX, e.clientY), s = stageRef.current!.getBoundingClientRect();
    if (!h) return;
    setActiveId(null);
    setDraft({ block: h.id, pos: fractionIn(h.rect, { x: e.clientX, y: e.clientY }), at: { x: e.clientX - s.left, y: e.clientY - s.top } });
  }

  const active = activeId ? pins.find((p) => p.id === activeId) ?? api.comments.find((c) => c.id === activeId) : null;
  const activeNode = active ? buildThreads(api.comments, "best").find((t) => t.comment.id === active.id) : null;
  const activePos = activeId ? layout.pins[activeId] : null;
  const popAt = (pt: { x: number; y: number }) => popoverPlacement(pt, { width: layout.width, height: layout.height }, POP);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <Button size="sm" variant={mode ? "default" : "outline"} aria-pressed={mode} onClick={() => { setMode((m) => !m); setDraft(null); setActiveId(null); }} title="Comment mode (C)">
          <MessageSquarePlus /> Comment mode
        </Button>
        <Button size="sm" variant="ghost" aria-pressed={showResolved} onClick={() => setShowResolved((v) => !v)}>{showResolved ? <Eye /> : <EyeOff />} Resolved pins</Button>
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {mode ? "Click anywhere on the page to comment · Esc to exit" : `${stats.open} open thread${stats.open === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div ref={stageRef} className="relative">
          <div ref={contentRef}><KageRenderer doc={doc} /></div>

          {mode && (
            <div ref={overlayRef} className="absolute inset-0 z-10 cursor-crosshair bg-primary/[0.03]" aria-hidden onMouseMove={onOverlayMove} onMouseLeave={() => setHover(null)} onClick={onOverlayClick} />
          )}
          {mode && hover && <div aria-hidden className="pointer-events-none absolute z-10 rounded-sm border-2 border-wire bg-wire/10" style={{ left: hover.left, top: hover.top, width: hover.width, height: hover.height }} />}
          {flashRect && <div aria-hidden className="pointer-events-none absolute z-10 animate-pulse rounded-sm border-2 border-wire bg-wire/15" style={{ left: flashRect.left, top: flashRect.top, width: flashRect.width, height: flashRect.height }} />}

          <div ref={pinsRef} className="pointer-events-none absolute inset-0 z-20">
            {pins.map((p) => {
              const at = layout.pins[p.id];
              if (!at) return null;
              const n = numbers.get(p.id), isActive = p.id === activeId;
              return (
                <button key={p.id} type="button" aria-label={`Comment ${n} by ${shortName(p.author)}${p.resolved ? " (resolved)" : ""}: ${p.text.slice(0, 60)}`} aria-expanded={isActive}
                  onClick={() => { setActiveId(isActive ? null : p.id); setDraft(null); }}
                  style={{ left: at.x, top: at.y }}
                  className={cn("pointer-events-auto absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-card font-mono text-[11px] font-semibold transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
                    p.resolved ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground", isActive && "scale-110 ring-3 ring-ring/60")}>
                  {p.resolved ? <Check className="size-3" aria-hidden /> : n}
                </button>
              );
            })}
            {draft && <span aria-hidden className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-dashed border-primary bg-card text-primary" style={{ left: draft.at.x, top: draft.at.y }}><MessageSquarePlus className="size-3" /></span>}
          </div>

          {draft && (
            <div ref={popRef} role="dialog" aria-label="New comment" className="absolute z-30 flex flex-col gap-2 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg" style={{ width: POP.width, ...popAt(draft.at) }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>New comment on</span><span className="rounded-sm bg-wire-soft px-1.5 font-mono text-[11px] text-wire">@{draft.block}</span>
                <Button size="icon-xs" variant="ghost" className="ml-auto" aria-label="Cancel" onClick={() => setDraft(null)}><X /></Button>
              </div>
              <Composer autoFocus compact placeholder="Write a comment…" onCancel={() => setDraft(null)}
                onSubmit={async (text) => { const r = await api.post({ text, block: draft.block, pos: draft.pos }); if (r) { setDraft(null); setActiveId(r.id); } return !!r; }} />
            </div>
          )}

          {activeNode && activePos && (
            <div ref={popRef} role="dialog" aria-label={`Comment thread ${numbers.get(activeNode.comment.id) ?? ""}`} className="absolute z-30 flex max-h-80 flex-col gap-2 overflow-y-auto rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg" style={{ width: POP.width, ...popAt(activePos) }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-sm bg-primary-soft px-1.5 font-mono text-[11px] text-primary">Pin {numbers.get(activeNode.comment.id)}</span>
                <span className="rounded-sm bg-wire-soft px-1.5 font-mono text-[11px] text-wire">@{activeNode.comment.block}</span>
                <Button size="icon-xs" variant="ghost" className="ml-auto" aria-label="Close thread" onClick={() => setActiveId(null)}><X /></Button>
              </div>
              <ul><CommentNode node={activeNode} api={api} /></ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
