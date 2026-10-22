"use client";

// The selected Kage, as a slide-over panel on top of the library instead of a
// permanent half-screen: the grid keeps the room when nothing is open, and a
// card opens into Overview / Preview / Versions / Describe. Preview renders the
// real KageRenderer inline (lazily, only on that tab); fullscreen is one button
// away. Every action is an operation over REST, same as any other client.

import { useEffect, useState } from "react";
import { Copy, Download, Expand, Folder, History } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareMenu } from "@/components/dashboard/share-menu";
import { StatusMenu } from "@/components/dashboard/status-menu";
import { KageFrame, StateBadge, SystemChip, ValidationStatus, op, relTime, type KageCard } from "@/components/dashboard/kage-ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DesignSelect, useDesigns } from "@/components/dashboard/designs/design-select";
import { CommentStage } from "@/components/dashboard/comments/comment-stage";
import { DiscussionPanel } from "@/components/dashboard/comments/discussion-panel";
import { discussionStats } from "@/components/dashboard/comments/comment-model";
import type { CommentsApi } from "@/components/dashboard/comments/use-comments";
import type { KageDoc } from "@/engine/types";

export interface VersionMeta {
  ref: string; v: number; state: string; createdAt: string; digest: string;
  author: { principal: string; runtime?: { framework?: string } };
  change: { summary: string; ops: number; blocksTouched: string[] };
  validation: { ok: boolean; errors: number; warnings: number };
}

interface Props {
  card: KageCard | null;
  doc: KageDoc | null;
  versions: VersionMeta[];
  describe: string;
  comments: CommentsApi;
  workspace: string;
  onClose: () => void;
  onFullscreen: () => void;
  onClone: (name: string) => void;
  onExport: (name: string) => void;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}

/** Change the Kage's design later. It saves a new version, which pins the design as it is right now. */
function DesignPicker({ name, current, pinned, onChanged }: { name: string; current: string; pinned?: string; onChanged: () => Promise<void> }) {
  const designs = useDesigns(true);
  const [busy, setBusy] = useState(false);
  if (!designs || (designs.designs.length === 0 && !current)) return null;
  async function apply(id: string) {
    setBusy(true);
    try { await op("set_kage_design", { name, design: id }); toast.success(id ? "Design applied in a new version" : "Design removed in a new version"); await onChanged(); }
    catch (e) { toast.error(String((e as Error).message)); } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`design-${name}`} className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Design</label>
      <div className="w-64"><DesignSelect id={`design-${name}`} value={current} designs={designs.designs} disabled={busy} onChange={(id) => void apply(id)} /></div>
      {current && !designs.designs.some((d) => d.id === current) && <span className="text-xs text-muted-foreground">“{pinned ?? current}” was deleted; this version keeps its look.</span>}
      {current && designs.designs.some((d) => d.id === current) && <Button size="xs" variant="ghost" disabled={busy} onClick={() => void apply(current)}>Update to latest</Button>}
    </div>
  );
}

/** Organize a Kage into projects beyond its home repo. The home repo is a fixed, implicit
 *  member (it is the Kage's signed identity and cannot be toggled off here); every other known
 *  project is a checkbox. Toggling saves the new membership with set_kage_projects — purely
 *  organizational, so it grants nobody access and does not create a new version. */
function ProjectPicker({ name, repo, projects, onChanged }: { name: string; repo: string; projects: string[]; onChanged: () => Promise<void> }) {
  const [all, setAll] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    op<{ projects: { project: string }[] }>("list_projects").then((r) => { if (live) setAll(r.projects.map((p) => p.project)); }).catch(() => { if (live) setAll([]); });
    return () => { live = false; };
  }, []);
  // The home repo is shown even if the registry never listed it (a repo is a project), and always first.
  const options = [...new Set([repo, ...(all ?? []), ...projects])].sort((a, b) => (a === repo ? -1 : b === repo ? 1 : a.localeCompare(b)));
  const member = new Set(projects);
  async function toggle(project: string) {
    if (project === repo) return; // home repo is implicit; never toggled
    // Send the full desired membership (minus home, which the store treats as implicit either way).
    const next = member.has(project) ? [...member].filter((p) => p !== project) : [...member, project];
    setBusy(true);
    try { await op("set_kage_projects", { name, projects: next.filter((p) => p !== repo) }); await onChanged(); }
    catch (e) { toast.error(String((e as Error).message)); } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Projects</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((project) => {
          const home = project === repo, on = home || member.has(project);
          return (
            <label key={project} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[13px]", on && "bg-primary-soft", home && "cursor-default opacity-80")}>
              <input type="checkbox" className="size-3.5 accent-[var(--primary)]" checked={on} disabled={busy || home} onChange={() => void toggle(project)} />
              {project}{home && <span className="font-sans text-[11px] text-muted-foreground">home</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}

const overline = "font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground";

export function DetailSheet({ card, doc, versions, describe, comments, workspace, onClose, onFullscreen, onClone, onExport, onChanged, onDeleted }: Props) {
  // Tabs are controlled so the Discussion tab can send you to the page: clicking
  // a comment's @block chip switches to Preview and flashes that block.
  const [tab, setTab] = useState("preview");
  const [flash, setFlash] = useState<{ block: string; nonce: number } | null>(null);
  useEffect(() => { setTab("preview"); setFlash(null); }, [card?.name]);
  const stats = discussionStats(comments.comments);
  const jump = (block: string) => { setTab("preview"); setFlash({ block, nonce: Date.now() }); };

  return (
    <Sheet open={!!card} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-3xl">
        {card && (
          <>
            <SheetHeader className="gap-2 border-b p-5 pr-14">
              <div className="flex flex-wrap items-center gap-2">
                <StateBadge state={card.state} />
                <Badge variant="secondary" className="capitalize">{card.visibility}</Badge>
                <SystemChip system={card.system} />
              </div>
              <SheetTitle className="font-display text-[22px] leading-7 font-[650] tracking-[-0.01em]">{card.title}</SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">{card.description || "No description yet."}</SheetDescription>
              <p className="font-mono text-xs text-muted-foreground">{card.ref}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!doc} onClick={onFullscreen}><Expand /> Fullscreen</Button>
                <Button size="sm" variant="outline" onClick={() => onClone(card.name)}><Copy /> Clone</Button>
                <Button size="sm" variant="outline" onClick={() => onExport(card.name)}><Download /> Export</Button>
                <ShareMenu name={card.name} uuid={card.uuid} state={card.state} visibility={card.visibility} onChanged={onChanged} />
                <StatusMenu name={card.name} state={card.state} onChanged={onChanged} onDeleted={onDeleted} />
              </div>
              <DesignPicker name={card.name} current={doc?.design ?? ""} pinned={doc?.resolved?.design?.name} onChanged={onChanged} />
              <ProjectPicker name={card.name} repo={card.repo} projects={card.projects?.length ? card.projects : [card.repo]} onChanged={onChanged} />
            </SheetHeader>

            <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="p-5">
              <TabsList variant="line" className="w-full justify-start gap-4 border-b">
                <TabsTrigger value="preview" className="flex-none">Preview</TabsTrigger>
                <TabsTrigger value="discussion" className="flex-none">Discussion {stats.total > 0 && <span className="rounded-sm bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">{stats.open > 0 ? `${stats.open} open` : stats.total}</span>}</TabsTrigger>
                <TabsTrigger value="overview" className="flex-none">Overview</TabsTrigger>
                <TabsTrigger value="versions" className="flex-none">Versions <span className="rounded-sm bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">{versions.length}</span></TabsTrigger>
                <TabsTrigger value="describe" className="flex-none">Describe</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="mt-4">
                {!doc ? <Skeleton className="h-64 w-full rounded-xl" /> : (
                  <KageFrame system={card.system} kageRef={card.ref} digest={versions.at(-1)?.digest}>
                    <CommentStage doc={doc} api={comments} flash={flash} className="max-h-[68svh]" />
                  </KageFrame>
                )}
              </TabsContent>

              <TabsContent value="discussion" className="mt-4">
                <DiscussionPanel api={comments} doc={doc} onJump={jump} />
              </TabsContent>

              <TabsContent value="overview" className="mt-4">
                <dl className="grid max-w-xl grid-cols-[150px_1fr] gap-y-3 text-sm">
                  <dt className="text-muted-foreground">Project</dt>
                  <dd className="inline-flex items-center gap-1.5 font-mono"><Folder className="size-3.5 text-muted-foreground" />{workspace} / {card.repo}</dd>
                  <dt className="text-muted-foreground">Block types</dt>
                  <dd className="flex flex-wrap gap-1">{card.kinds.length ? card.kinds.map((k) => <span key={k} className="rounded-sm bg-muted px-1.5 font-mono text-[11px] leading-[18px] text-muted-foreground">{k}</span>) : <span className="text-muted-foreground">Layout and text only</span>}</dd>
                  <dt className="text-muted-foreground">Mode</dt><dd>{doc?.brief?.mode ?? <span className="text-muted-foreground">Not declared</span>}</dd>
                  {doc?.brief?.audience && <><dt className="text-muted-foreground">Audience</dt><dd>{doc.brief.audience}</dd></>}
                  {doc?.brief?.job && <><dt className="text-muted-foreground">Their job</dt><dd>{doc.brief.job}</dd></>}
                  {doc?.brief?.primaryAction && <><dt className="text-muted-foreground">Primary action</dt><dd>{doc.brief.primaryAction}</dd></>}
                  <dt className="text-muted-foreground">Blocks</dt><dd>{card.blocks}</dd>
                  <dt className="text-muted-foreground">Version</dt><dd className="font-mono">v{card.version}</dd>
                  <dt className="text-muted-foreground">Updated</dt><dd>{relTime(card.createdAt)}</dd>
                  <dt className="text-muted-foreground">Validation</dt><dd><ValidationStatus validation={card.validation} /></dd>
                  <dt className="text-muted-foreground">Last author</dt><dd className="font-mono text-xs">{card.lastAuthor}</dd>
                  <dt className="text-muted-foreground">Root block</dt><dd className="font-mono">{doc?.root ?? "…"}</dd>
                  <dt className="text-muted-foreground">Lockfile</dt><dd>{doc?.resolved ? `${Object.keys(doc.resolved.blocks).length} pinned refs` : "…"}</dd>
                </dl>
              </TabsContent>

              <TabsContent value="versions" className="mt-4">
                <p className={overline}>History, newest first</p>
                <div className="mt-2 divide-y">
                  {[...versions].reverse().map((v) => (
                    <div key={v.v} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
                      <div className="flex items-center gap-1.5"><History className="size-4 text-muted-foreground" /><span className="font-mono font-semibold">v{v.v}</span></div>
                      <div className="min-w-0">
                        <div className="text-sm">{v.change.summary} <span className="text-xs text-muted-foreground">· {v.change.ops} ops · {v.change.blocksTouched.length} blocks</span></div>
                        <div className="truncate font-mono text-xs text-muted-foreground">{v.author.principal}{v.author.runtime?.framework ? ` · ${v.author.runtime.framework}` : ""} · {v.digest.slice(0, 19)}…</div>
                      </div>
                      <div className="flex items-center gap-2"><StateBadge state={v.state} /><span className="text-xs text-muted-foreground">{relTime(v.createdAt)}</span></div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="describe" className="mt-4">
                <pre className="overflow-auto rounded-xl border bg-muted p-4 font-mono text-[12.5px] leading-[18px]">{describe || "…"}</pre>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
