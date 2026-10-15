"use client";

// Reddit-style discussion UI: a vote column, nested replies with a collapsible
// thread line, inline reply/edit composers. Used in the Discussion tab and, for a
// single thread, inside a pin's popover. Comment text is rendered as plain text
// (pre-wrapped) — never as markup — because every comment is untrusted input.

import { useId, useState } from "react";
import { Check, ChevronDown, ChevronUp, CornerDownRight, MessageSquare, Minus, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { relTime } from "@/components/dashboard/kage-ui";
import { countLive, shortName, type ThreadNode } from "./comment-model";
import type { CommentsApi } from "./use-comments";

const MAX = 4000;

export function Composer({ placeholder, submitLabel = "Comment", initial = "", autoFocus, onSubmit, onCancel, compact }: {
  placeholder?: string; submitLabel?: string; initial?: string; autoFocus?: boolean; compact?: boolean;
  onSubmit: (text: string) => Promise<boolean>; onCancel?: () => void;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const ok = text.trim().length > 0 && text.length <= MAX;
  async function send() {
    if (!ok || busy) return;
    setBusy(true);
    const done = await onSubmit(text);
    setBusy(false);
    if (done) setText("");
  }
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">{placeholder ?? "Write a comment"}</label>
      <textarea id={id} value={text} autoFocus={autoFocus} rows={compact ? 2 : 3} placeholder={placeholder ?? "Write a comment…"} maxLength={MAX + 200}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void send(); } if (e.key === "Escape" && onCancel) { e.stopPropagation(); onCancel(); } }}
        className="w-full resize-y rounded-md border border-input bg-card px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
      <div className="flex items-center gap-2">
        {text.length > MAX - 500 && <span className={cn("font-mono text-xs", text.length > MAX ? "text-destructive" : "text-muted-foreground")}>{text.length}/{MAX}</span>}
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">⌘↵ to send</span>
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button size="sm" disabled={!ok || busy} onClick={send}>{busy ? "Sending…" : submitLabel}</Button>
      </div>
    </div>
  );
}

function Votes({ node, api }: { node: ThreadNode; api: CommentsApi }) {
  const c = node.comment;
  const set = (v: 1 | -1) => api.vote(c.id, c.myVote === v ? 0 : v);
  const title = (what: string) => (c.canVote ? what : c.canEdit ? "You can't vote on your own comment" : "Sign in to vote");
  return (
    <div className="flex w-6 shrink-0 flex-col items-center" role="group" aria-label="Vote">
      <Button size="icon-xs" variant="ghost" aria-pressed={c.myVote === 1} aria-label="Upvote" title={title("Upvote")} disabled={!c.canVote} onClick={() => set(1)}><ChevronUp className={cn(c.myVote === 1 && "text-primary")} /></Button>
      <span className={cn("font-mono text-xs tabular-nums", c.myVote === 1 && "text-primary", c.myVote === -1 && "text-destructive", !c.myVote && "text-muted-foreground")} aria-label={`Score ${c.score}`}>{c.score}</span>
      <Button size="icon-xs" variant="ghost" aria-pressed={c.myVote === -1} aria-label="Downvote" title={title("Downvote")} disabled={!c.canVote} onClick={() => set(-1)}><ChevronDown className={cn(c.myVote === -1 && "text-destructive")} /></Button>
    </div>
  );
}

export function CommentNode({ node, api, depth = 0, pinNumber, orphan, onJump, defaultCollapsed }: {
  node: ThreadNode; api: CommentsApi; depth?: number; pinNumber?: Map<string, number>; orphan?: (block: string) => boolean;
  onJump?: (block: string) => void; defaultCollapsed?: boolean;
}) {
  const c = node.comment;
  const [collapsed, setCollapsed] = useState(!!defaultCollapsed);
  const [mode, setMode] = useState<"" | "reply" | "edit">("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const live = countLive(node);
  const pin = pinNumber?.get(c.id);
  const isRoot = !c.parent;

  return (
    <li className="flex gap-2" data-comment={c.id}>
      {c.deleted ? <div className="w-6 shrink-0" /> : <Votes node={node} api={api} />}
      <div className={cn("min-w-0 flex-1", depth > 0 && "pl-0")}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <Button size="icon-xs" variant="ghost" aria-label={collapsed ? "Expand thread" : "Collapse thread"} aria-expanded={!collapsed} onClick={() => setCollapsed((v) => !v)}>{collapsed ? <Plus /> : <Minus />}</Button>
          <span className={cn("font-mono", c.deleted ? "italic" : c.canEdit ? "font-medium text-foreground" : "text-foreground")}>{c.deleted ? "[deleted]" : c.canEdit ? `${shortName(c.author)} (you)` : shortName(c.author)}</span>
          <span>·</span><time dateTime={c.createdAt}>{relTime(c.createdAt)}</time>
          {c.editedAt && <span title={`edited ${relTime(c.editedAt)}`}>(edited)</span>}
          {pin !== undefined && <span className="rounded-sm bg-primary-soft px-1.5 font-mono text-[11px] text-primary">Pin {pin}</span>}
          {c.block && !c.deleted && (orphan?.(c.block)
            ? <span className="rounded-sm bg-warning-soft px-1.5 font-mono text-[11px] text-warning" title="This block was removed or renamed in the current version">@{c.block} · removed</span>
            : onJump ? <button type="button" onClick={() => onJump(c.block)} className="rounded-sm bg-wire-soft px-1.5 font-mono text-[11px] text-wire hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" title="Show this block in the preview">@{c.block}</button>
            : <span className="rounded-sm bg-wire-soft px-1.5 font-mono text-[11px] text-wire">@{c.block}</span>)}
          {isRoot && c.resolved && !c.deleted && <span className="inline-flex items-center gap-1 rounded-sm bg-success-soft px-1.5 text-[11px] text-success"><Check className="size-3" aria-hidden />Resolved</span>}
          {c.version !== undefined && isRoot && !c.deleted && <span className="font-mono text-[11px]">v{c.version}</span>}
        </div>

        {collapsed ? (
          <p className="mt-1 text-xs text-muted-foreground">{live} comment{live === 1 ? "" : "s"} hidden</p>
        ) : (
          <>
            {mode === "edit" ? (
              <div className="mt-1.5"><Composer autoFocus initial={c.text} submitLabel="Save" onCancel={() => setMode("")} onSubmit={async (t) => { const ok = await api.edit(c.id, t); if (ok) setMode(""); return false; }} /></div>
            ) : c.deleted ? (
              <p className="mt-1 text-sm text-muted-foreground italic">This comment was deleted.</p>
            ) : (
              <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">{c.text}</p>
            )}

            {!c.deleted && mode !== "edit" && (
              <div className="mt-1 flex flex-wrap items-center gap-0.5 text-xs">
                <Button size="xs" variant="ghost" onClick={() => setMode(mode === "reply" ? "" : "reply")}><CornerDownRight /> Reply</Button>
                {c.canResolve && <Button size="xs" variant="ghost" onClick={() => api.resolve(c.id, !c.resolved)}>{c.resolved ? <><RotateCcw /> Reopen</> : <><Check /> Resolve</>}</Button>}
                {c.canEdit && <Button size="xs" variant="ghost" onClick={() => setMode("edit")}><Pencil /> Edit</Button>}
                {c.canDelete && (confirmDelete
                  ? <><Button size="xs" variant="ghost" className="text-destructive" onClick={async () => { await api.remove(c.id); setConfirmDelete(false); }}><Trash2 /> Confirm delete</Button><Button size="xs" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button></>
                  : <Button size="xs" variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</Button>)}
              </div>
            )}

            {mode === "reply" && (
              <div className="mt-2"><Composer autoFocus compact placeholder={`Reply to ${shortName(c.author)}…`} submitLabel="Reply" onCancel={() => setMode("")}
                onSubmit={async (t) => { const r = await api.post({ text: t, parent: c.id }); if (r) setMode(""); return !!r; }} /></div>
            )}

            {node.replies.length > 0 && (
              <ul className="mt-2 flex flex-col gap-3 border-l pl-3" aria-label="Replies">
                {node.replies.map((r) => <CommentNode key={r.comment.id} node={r} api={api} depth={depth + 1} orphan={orphan} onJump={onJump} />)}
              </ul>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export function EmptyDiscussion({ onStart }: { onStart?: () => void }) {
  return (
    <div className="mx-auto mt-6 max-w-sm text-center">
      <MessageSquare aria-hidden className="mx-auto size-6 text-muted-foreground" />
      <h4 className="mt-2 font-display text-base font-[650]">No comments yet</h4>
      <p className="mt-1 text-sm text-muted-foreground">Start the conversation, or turn on comment mode in the preview and click anywhere on the page to leave a note exactly where it applies.</p>
      {onStart && <Button className="mt-3" size="sm" variant="outline" onClick={onStart}>Write the first comment</Button>}
    </div>
  );
}
