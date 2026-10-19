"use client";

// The Library: browse and organise every Kage. A facet rail (scope, project,
// status, system — each with live counts) narrows a grid or list of rich cards;
// search, sort, grouping and view are one toolbar; a card opens into a slide-over
// detail panel. The whole view lives in the URL, so a filtered, sorted view is a
// link you can share, and Back closes the panel. All reads and writes are the one
// operation set over REST — this page holds no privileged access, and the
// filtering/faceting logic is the pure, tested library-model.
// See the dashboard-over-adapters skill.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, Folder, LayoutGrid, List, Plus, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { KagePreview } from "@/components/dashboard/kage-preview";
import { KageRow, KageTile } from "@/components/dashboard/library/kage-tile";
import { FacetRail } from "@/components/dashboard/library/facet-rail";
import { NewKageSheet } from "@/components/dashboard/library/new-kage-sheet";
import { DetailSheet, type VersionMeta } from "@/components/dashboard/library/detail-sheet";
import { BriefSheet, loadBrief, type BriefData } from "@/components/dashboard/brief/brief-sheet";
import { useComments } from "@/components/dashboard/comments/use-comments";
import { CommentStage } from "@/components/dashboard/comments/comment-stage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { op, type KageCard } from "@/components/dashboard/kage-ui";
import {
  GROUP_LABEL, SORT_LABEL, activeChips, facetCounts, filterCards, groupCards, parsePins, parseQuery, resolveScope, serializeQuery, sortCards,
  type Group, type Query, type Sort,
} from "@/components/dashboard/library-model";
import type { KageDoc } from "@/engine/types";

const PINS_KEY = "kages.pins";
const overline = "font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground";

function LibraryInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const paramString = params.toString();
  const query = useMemo(() => parseQuery(new URLSearchParams(paramString)), [paramString]);
  const openName = params.get("id");

  const [cards, setCards] = useState<KageCard[] | null>(null);
  const [workspace, setWorkspace] = useState("workspace");
  const [pins, setPins] = useState<Set<string>>(new Set());
  const [doc, setDoc] = useState<KageDoc | null>(null);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [describe, setDescribe] = useState("");
  const [fullscreen, setFullscreen] = useState<{ doc: KageDoc; ref: string } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // undefined = not loaded; null = this person cannot see a brief (so no prompt to write one).
  const [brief, setBrief] = useState<BriefData | null | undefined>(undefined);
  const [briefOpen, setBriefOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => { void loadBrief().then(setBrief); }, []);
  const comments = useComments(openName);
  const [text, setText] = useState(query.q);
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // --- URL is the state ------------------------------------------------------
  // Filters replace history (a filter tweak is not a place you navigate back to);
  // opening a Kage pushes it, so Back closes the panel the way people expect.
  const go = useCallback((next: URLSearchParams, push = false) => {
    const qs = next.toString();
    (push ? router.push : router.replace)(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router]);
  const setQuery = useCallback((patch: Partial<Query>) => {
    const next = serializeQuery({ ...query, ...patch });
    if (openName) next.set("id", openName);
    go(next);
  }, [query, openName, go]);
  const open = useCallback((name: string | null) => {
    const next = serializeQuery(query);
    if (name) next.set("id", name);
    go(next, true);
  }, [query, go]);

  // Typing updates the box instantly and the URL after a short pause, so the
  // address bar does not thrash and the history stays clean.
  useEffect(() => { setText(query.q); }, [query.q]);
  useEffect(() => {
    if (text === query.q) return;
    const t = setTimeout(() => setQuery({ q: text }), 180);
    return () => clearTimeout(t);
  }, [text, query.q, setQuery]);

  // --- data ------------------------------------------------------------------
  const refresh = useCallback(async () => {
    try {
      const [k, r] = await Promise.all([op<KageCard[]>("list_kages"), op<{ workspace: string; projects: { repo: string; count: number }[] }>("list_repos")]);
      setCards(k); setWorkspace(r.workspace);
    } catch (e) { toast.error(String((e as Error).message)); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => { try { setPins(parsePins(localStorage.getItem(PINS_KEY))); } catch { /* storage unavailable: pins last for the session */ } }, []);
  const togglePin = useCallback((name: string) => {
    setPins((prev) => {
      const next = new Set(prev); if (!next.delete(name)) next.add(name);
      try { localStorage.setItem(PINS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Detail loads only for the open Kage: the document, history and text view.
  useEffect(() => {
    setDoc(null); setVersions([]); setDescribe("");
    if (!openName) return;
    let live = true;
    Promise.all([op<KageDoc>("get_kage", { name: openName }), op<VersionMeta[]>("list_versions", { name: openName }), op<string>("describe_kage", { name: openName })])
      .then(([d, v, desc]) => { if (live) { setDoc(d); setVersions(v); setDescribe(desc); } })
      .catch((e) => { if (live) toast.error(String((e as Error).message)); });
    return () => { live = false; };
  }, [openName]);

  // --- derived view ----------------------------------------------------------
  const all = cards ?? [];
  const resolvedScope = resolveScope(query.scope, all);
  const visible = useMemo(() => sortCards(filterCards(all, query, pins, openName ?? undefined), query.sort), [all, query, pins, openName]);
  const groups = useMemo(() => groupCards(visible, query.group), [visible, query.group]);
  const facets = useMemo(() => facetCounts(all, query, pins, openName ?? undefined), [all, query, pins, openName]);
  const chips = activeChips(query);
  const current = all.find((c) => c.name === openName) ?? null;
  const templateCount = facets.scope.templates;

  // --- actions ---------------------------------------------------------------
  function newProject() {
    const raw = window.prompt("New project name (a–z, 0–9, -):");
    const slug = (raw ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) return;
    setQuery({ repo: slug, scope: "all" });
    toast.message(`Project “${slug}” — import or create a Kage to populate it`);
  }
  async function exportJson(name: string) {
    const json = await op<string>("export_kage", { name, format: "json" });
    const blob = new Blob([typeof json === "string" ? json : JSON.stringify(json, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.kage.json`; a.click();
  }
  async function importFile(file: File) {
    const repo = query.repo || "kages";
    try { await op("create_kage", { doc: JSON.parse(await file.text()), repo }); toast.success(`Imported ${file.name} into ${repo}`); await refresh(); }
    catch (e) { toast.error(`Import failed: ${(e as Error).message}`); }
  }
  async function cloneKage(name: string) {
    try {
      const r = await op<{ version?: { name: string } }>("clone_kage", { name });
      toast.success("Cloned"); await refresh();
      if (r?.version?.name) open(r.version.name);
    } catch (e) { toast.error(String((e as Error).message)); }
  }
  async function previewCard(card: KageCard) {
    try { setFullscreen({ doc: await op<KageDoc>("get_kage", { uuid: card.uuid }), ref: card.ref }); }
    catch (e) { toast.error(String((e as Error).message)); }
  }

  // --- keyboard --------------------------------------------------------------
  // "/" jumps to search (the convention in every list-heavy tool); arrows move
  // between cards in reading order. Both stand down while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  function onResultsKey(e: React.KeyboardEvent) {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)) return;
    const targets = Array.from(resultsRef.current?.querySelectorAll<HTMLElement>("[data-open]") ?? []);
    const i = targets.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const next = targets[i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1)];
    if (next) { e.preventDefault(); next.focus(); next.scrollIntoView({ block: "nearest" }); }
  }

  const rail = (
    <FacetRail query={query} resolvedScope={resolvedScope} facets={facets} workspace={workspace} onChange={setQuery} onNewProject={newProject} />
  );
  const empty = cards !== null && cards.length === 0;

  const renderCard = (c: KageCard) => {
    const p = { card: c, selected: c.name === openName, pinned: pins.has(c.name), onOpen: open, onPin: togglePin, onPreview: previewCard };
    return query.view === "list" ? <KageRow key={c.name} {...p} /> : <KageTile key={c.name} {...p} />;
  };

  return (
    <div className="flex h-[calc(100svh-3.5rem)]">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r p-3 md:block">{rail}</aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 md:px-6">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] leading-7 font-[650] tracking-[-0.01em]">Library</h2>
            <p className="text-sm text-muted-foreground">{cards ? `${visible.length} of ${all.length} Kages` : "Loading…"}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {brief !== null && <Button size="sm" variant="outline" onClick={() => setBriefOpen(true)}><FileText /> Brief{brief && !brief.brief ? <span aria-label="not set" className="size-1.5 rounded-full bg-primary" /> : null}</Button>}
            <Button size="sm" variant="outline" nativeButton={false} render={<label />}>
              <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
              <Upload /> Import
            </Button>
            <Button size="sm" onClick={() => setNewOpen(true)}><Plus /> New Kage</Button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 md:px-6">
          <Button size="sm" variant="outline" className="md:hidden" onClick={() => setFiltersOpen(true)}><SlidersHorizontal /> Filters{chips.length ? ` (${chips.length})` : ""}</Button>
          <div className="relative min-w-48 flex-1 md:max-w-md">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={searchRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setText(""); (e.target as HTMLInputElement).blur(); } }}
              placeholder="Search Kages…" aria-label="Search Kages" className="pr-8 pl-8" />
            {text ? (
              <button type="button" aria-label="Clear search" onClick={() => { setText(""); searchRef.current?.focus(); }} className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:bg-accent"><X className="size-3.5" /></button>
            ) : (
              <kbd aria-hidden className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border px-1.5 font-mono text-[11px] text-muted-foreground">/</kbd>
            )}
          </div>
          <Select value={query.sort} onValueChange={(v) => v && setQuery({ sort: v as Sort })}>
            <SelectTrigger className="w-44" aria-label="Sort"><SelectValue>{SORT_LABEL[query.sort]}</SelectValue></SelectTrigger>
            <SelectContent>{(Object.keys(SORT_LABEL) as Sort[]).map((s) => <SelectItem key={s} value={s}>{SORT_LABEL[s]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={query.group} onValueChange={(v) => v && setQuery({ group: v as Group })}>
            <SelectTrigger className="w-44" aria-label="Grouping"><SelectValue>{GROUP_LABEL[query.group]}</SelectValue></SelectTrigger>
            <SelectContent>{(Object.keys(GROUP_LABEL) as Group[]).map((g) => <SelectItem key={g} value={g}>{GROUP_LABEL[g]}</SelectItem>)}</SelectContent>
          </Select>
          <div role="group" aria-label="View" className="flex rounded-md border border-input">
            <Button size="icon" variant={query.view === "grid" ? "secondary" : "ghost"} aria-pressed={query.view === "grid"} aria-label="Grid view" className="rounded-r-none" onClick={() => setQuery({ view: "grid" })}><LayoutGrid /></Button>
            <Button size="icon" variant={query.view === "list" ? "secondary" : "ghost"} aria-pressed={query.view === "list"} aria-label="List view" className="rounded-l-none" onClick={() => setQuery({ view: "list" })}><List /></Button>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 md:px-6" aria-label="Active filters">
            {chips.map((c) => (
              <button key={c.key} type="button" onClick={() => { if ("q" in c.clear) setText(""); setQuery(c.clear); }} aria-label={`Remove filter ${c.label}`}
                className="inline-flex items-center gap-1 rounded-sm bg-muted py-0.5 pr-1 pl-2 text-xs hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                {c.label}<X className="size-3.5 text-muted-foreground" aria-hidden />
              </button>
            ))}
            <Button size="xs" variant="ghost" onClick={() => { setText(""); setQuery({ q: "", repo: "", states: [], systems: [], modes: [] }); }}>Clear all</Button>
          </div>
        )}

        {brief && !brief.brief && !empty && (
          <div className="flex flex-wrap items-center gap-3 border-b bg-muted px-4 py-2.5 text-sm md:px-6">
            <span className="min-w-0 flex-1">Agents here have no brief to work from. Add who this is for and what must never be invented.</span>
            <Button size="sm" onClick={() => setBriefOpen(true)}>Add your brief</Button>
          </div>
        )}

        <div ref={resultsRef} onKeyDown={onResultsKey} className="@container min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6" aria-live="polite" aria-busy={cards === null}>
          {cards === null && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
          )}

          {empty && (
            <div className="mx-auto mt-16 max-w-md text-center">
              <h3 className="font-display text-lg font-[650]">Your library is empty</h3>
              <p className="mt-1 text-sm text-muted-foreground">Kages built by you or an agent show up here. Create one from a starter, or import a <span className="font-mono">.kage.json</span> file.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button onClick={() => setNewOpen(true)}><Plus /> New Kage</Button>
              </div>
            </div>
          )}

          {cards !== null && !empty && visible.length === 0 && (
            <div className="mx-auto mt-16 max-w-md text-center">
              <h3 className="font-display text-lg font-[650]">No Kages match</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {resolvedScope === "pinned" ? "Pin a Kage with its star to keep it close." : chips.length ? "Nothing fits these filters." : resolvedScope === "mine" ? "You have no Kages of your own in this view yet." : "Nothing here yet."}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {chips.length > 0 && <Button variant="outline" onClick={() => { setText(""); setQuery({ q: "", repo: "", states: [], systems: [], modes: [] }); }}>Clear filters</Button>}
                {resolvedScope !== "templates" && templateCount > 0 && <Button variant="outline" onClick={() => setQuery({ scope: "templates", repo: "" })}>Browse {templateCount} templates</Button>}
                {resolvedScope !== "all" && <Button variant="ghost" onClick={() => setQuery({ scope: "all", repo: "", states: [], systems: [], modes: [] })}>Show everything</Button>}
              </div>
            </div>
          )}

          {groups.map((g) => (
            <section key={g.key} aria-label={g.label || "Kages"} className={cn(g.label && "mb-8")}>
              {g.label && (
                <h3 className={cn(overline, "mb-3 flex items-center gap-1.5")}>
                  {query.group === "project" && <Folder aria-hidden className="size-3.5" />}{g.label}<span className="font-normal normal-case tracking-normal">· {g.items.length}</span>
                </h3>
              )}
              {query.view === "list" ? (
                <div className="overflow-hidden rounded-xl border bg-card">{g.items.map(renderCard)}</div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">{g.items.map(renderCard)}</div>
              )}
            </section>
          ))}
        </div>
      </main>

      <DetailSheet card={current} doc={doc} versions={versions} describe={describe} comments={comments} workspace={workspace}
        onClose={() => open(null)} onFullscreen={() => doc && current && setFullscreen({ doc, ref: current.ref })}
        onClone={cloneKage} onExport={exportJson}
        onChanged={async () => { await refresh(); }} onDeleted={async () => { open(null); await refresh(); }} />

      <NewKageSheet open={newOpen} onOpenChange={setNewOpen} repo={query.repo || "kages"} onCreated={async (name) => { await refresh(); const next = serializeQuery(query); next.set("id", name); go(next, true); }} />
      <BriefSheet open={briefOpen} onOpenChange={setBriefOpen} onSaved={setBrief} />

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-80 max-w-[85vw] overflow-y-auto">
          <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
          <div className="px-3 pb-4">{rail}</div>
        </SheetContent>
      </Sheet>

      {fullscreen && <KagePreview doc={fullscreen.doc} kageRef={fullscreen.ref} onClose={() => setFullscreen(null)}
        body={openName && fullscreen.doc.id === openName ? <CommentStage doc={fullscreen.doc} api={comments} className="h-full" fill /> : undefined} />}
    </div>
  );
}

export default function ArtifactsPage() {
  return <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}><LibraryInner /></Suspense>;
}
