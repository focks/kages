"use client";

// The selected Kage, as a slide-over panel on top of the library instead of a
// permanent half-screen: the grid keeps the room when nothing is open, and a
// card opens into Overview / Preview / Versions / Describe. Preview renders the
// real KageRenderer inline (lazily, only on that tab); fullscreen is one button
// away. Every action is an operation over REST, same as any other client.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Download, Expand, Folder, History, SquarePen } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareMenu } from "@/components/dashboard/share-menu";
import { StatusMenu } from "@/components/dashboard/status-menu";
import { KageFrame, StateBadge, SystemChip, ValidationStatus, relTime, type KageCard } from "@/components/dashboard/kage-ui";
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
                <Button render={<Link href={`/studio?kage=${card.name}`} />} nativeButton={false} size="sm" variant="outline"><SquarePen /> Edit in Studio</Button>
                <Button size="sm" variant="outline" disabled={!doc} onClick={onFullscreen}><Expand /> Fullscreen</Button>
                <Button size="sm" variant="outline" onClick={() => onClone(card.name)}><Copy /> Clone</Button>
                <Button size="sm" variant="outline" onClick={() => onExport(card.name)}><Download /> Export</Button>
                <ShareMenu name={card.name} uuid={card.uuid} state={card.state} visibility={card.visibility} onChanged={onChanged} />
                <StatusMenu name={card.name} state={card.state} onChanged={onChanged} onDeleted={onDeleted} />
              </div>
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
