"use client";

// The Discussion tab: everything said about a Kage, as threads. A comment can be
// about the whole Kage or one block (the "About" picker is also the keyboard
// route to block-anchored comments, since pinning on the page is a pointer
// gesture). Sorting and the resolved filter are local view choices.

import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { KageDoc } from "@/engine/types";
import { CommentNode, Composer, EmptyDiscussion } from "./comment-thread";
import { SORT_LABEL, buildThreads, discussionStats, isOrphan, pinNumbers, type CommentSort } from "./comment-model";
import type { CommentsApi } from "./use-comments";

const overline = "font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground";

export function DiscussionPanel({ api, doc, onJump }: { api: CommentsApi; doc: KageDoc | null; onJump?: (block: string) => void }) {
  const [sort, setSort] = useState<CommentSort>("best");
  const [showResolved, setShowResolved] = useState(true);
  const [about, setAbout] = useState("");
  const blockIds = useMemo(() => new Set(Object.keys(doc?.blocks ?? {})), [doc]);
  const options = useMemo(() => Object.entries(doc?.blocks ?? {}).slice(0, 300).map(([id, b]) => ({ id, label: `${id} · ${b.type}` })), [doc]);
  const threads = useMemo(() => buildThreads(api.comments, sort, { showResolved }), [api.comments, sort, showResolved]);
  const pins = useMemo(() => pinNumbers(api.comments), [api.comments]);
  const stats = discussionStats(api.comments);
  const orphan = (block: string) => !!doc && isOrphan({ block } as never, blockIds);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className={overline}>{stats.total} comment{stats.total === 1 ? "" : "s"} · {stats.open} open · {stats.resolved} resolved</p>
        <div className="ml-auto flex items-center gap-2">
          <Button size="xs" variant="ghost" aria-pressed={showResolved} onClick={() => setShowResolved((v) => !v)}>{showResolved ? <Eye /> : <EyeOff />} Resolved</Button>
          <Select value={sort} onValueChange={(v) => v && setSort(v as CommentSort)}>
            <SelectTrigger className="h-7 w-32" aria-label="Sort comments"><SelectValue>{SORT_LABEL[sort]}</SelectValue></SelectTrigger>
            <SelectContent>{(Object.keys(SORT_LABEL) as CommentSort[]).map((s) => <SelectItem key={s} value={s}>{SORT_LABEL[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>About</span>
          <select value={about} onChange={(e) => setAbout(e.target.value)} aria-label="What this comment is about"
            className="min-w-0 flex-1 rounded-md border border-input bg-card px-2 py-1 font-mono text-xs text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <option value="">The whole Kage</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <Composer placeholder="Add to the discussion…" onSubmit={async (text) => !!(await api.post({ text, block: about || undefined }))} />
      </div>

      {api.loading && api.comments.length === 0 && <p className="text-sm text-muted-foreground">Loading discussion…</p>}
      {!api.loading && api.comments.length === 0 && <EmptyDiscussion />}
      {threads.length > 0 && (
        <ul className="flex flex-col gap-5" aria-label="Comments">
          {threads.map((t) => <CommentNode key={t.comment.id} node={t} api={api} pinNumber={pins} orphan={orphan} onJump={onJump} />)}
        </ul>
      )}
      {api.comments.length > 0 && threads.length === 0 && <p className="text-sm text-muted-foreground">All threads are resolved. Show resolved to read them.</p>}
    </div>
  );
}
