// Pure logic for the discussion UI: turning the flat list `list_comments` returns
// into threads, ordering them, numbering pins and spotting orphans. No React and
// no fetching, so it is unit-tested; the components are layout over it.

/** A comment as the server describes it to one viewer (mirrors the store's view). */
export interface CommentItem {
  id: string; kage: string; block: string; author: string; text: string; resolved: boolean; createdAt: string;
  parent?: string; pos?: { x: number; y: number }; version?: number; editedAt?: string; resolvedBy?: string; deleted?: boolean;
  score: number; myVote: number; canEdit: boolean; canDelete: boolean; canResolve: boolean; canVote: boolean;
}

export type CommentSort = "best" | "new" | "old";
export const SORT_LABEL: Record<CommentSort, string> = { best: "Best", new: "Newest", old: "Oldest" };

export interface ThreadNode { comment: CommentItem; replies: ThreadNode[] }

const time = (c: CommentItem) => { const t = Date.parse(c.createdAt); return Number.isNaN(t) ? 0 : t; };
const numericId = (c: CommentItem) => Number(c.id.replace(/^c/, "")) || 0;

/** "Best" is the forum default: higher score first, ties broken oldest-first so a
 *  conversation reads in the order it happened. */
const order: Record<CommentSort, (a: CommentItem, b: CommentItem) => number> = {
  best: (a, b) => b.score - a.score || time(a) - time(b) || numericId(a) - numericId(b),
  new: (a, b) => time(b) - time(a) || numericId(b) - numericId(a),
  old: (a, b) => time(a) - time(b) || numericId(a) - numericId(b),
};

/** Build the forest of threads. A reply whose parent is missing (a corrupt or
 *  partially loaded list) is promoted to a root rather than silently dropped. */
export function buildThreads(comments: readonly CommentItem[], sort: CommentSort, opts: { showResolved?: boolean } = {}): ThreadNode[] {
  const ids = new Set(comments.map((c) => c.id));
  const children = new Map<string, CommentItem[]>();
  const roots: CommentItem[] = [];
  for (const c of comments) {
    if (c.parent && ids.has(c.parent) && c.parent !== c.id) { const l = children.get(c.parent); if (l) l.push(c); else children.set(c.parent, [c]); }
    else roots.push(c);
  }
  const seen = new Set<string>();
  const node = (c: CommentItem): ThreadNode => {
    seen.add(c.id); // a parent cycle in bad data cannot recurse forever
    return { comment: c, replies: (children.get(c.id) ?? []).filter((k) => !seen.has(k.id)).sort(order[sort]).map(node) };
  };
  return roots.filter((r) => opts.showResolved !== false || !r.resolved).sort(order[sort]).map(node);
}

export function countNodes(n: ThreadNode): number { return 1 + n.replies.reduce((s, r) => s + countNodes(r), 0); }
/** Live (not deleted) comments in a subtree: what "N replies" should say. */
export function countLive(n: ThreadNode): number { return (n.comment.deleted ? 0 : 1) + n.replies.reduce((s, r) => s + countLive(r), 0); }

export interface Stats { total: number; threads: number; open: number; resolved: number }
export function discussionStats(comments: readonly CommentItem[]): Stats {
  const live = comments.filter((c) => !c.deleted);
  const roots = comments.filter((c) => !c.parent && !c.deleted);
  return { total: live.length, threads: roots.length, open: roots.filter((r) => !r.resolved).length, resolved: roots.filter((r) => r.resolved).length };
}

/** A pin is a thread root with a position inside a block. Numbers follow
 *  creation order and never change when others are resolved or deleted, so
 *  "see pin 3" stays true in a conversation. */
export function pinNumbers(comments: readonly CommentItem[]): Map<string, number> {
  const pins = comments.filter((c) => !c.parent && c.pos && c.block && !c.deleted).sort((a, b) => time(a) - time(b) || numericId(a) - numericId(b));
  return new Map(pins.map((c, i) => [c.id, i + 1]));
}

/** Pins that should be drawn on the page: not orphaned, and open unless asked. */
export function visiblePins(comments: readonly CommentItem[], blockIds: ReadonlySet<string>, showResolved: boolean): CommentItem[] {
  return comments.filter((c) => !c.parent && c.pos && c.block && !c.deleted && blockIds.has(c.block) && (showResolved || !c.resolved));
}

/** A comment about a block that no longer exists in the current version. */
export const isOrphan = (c: CommentItem, blockIds: ReadonlySet<string>): boolean => !!c.block && !blockIds.has(c.block);

/** "user:ada" → "ada", "agent:acme/a11y" → "acme/a11y". Display only; never trusted. */
export function shortName(principal: string): string {
  if (!principal) return "deleted";
  return principal.replace(/^(user|agent|service):/, "").slice(0, 40);
}

/** Where a comment's thread popover should open, kept inside the stage: prefer
 *  right of the pin, flip left near the right edge, clamp vertically. */
export function popoverPlacement(pin: { x: number; y: number }, stage: { width: number; height: number }, size: { width: number; height: number }): { left: number; top: number } {
  const gap = 14;
  let left = pin.x + gap;
  if (left + size.width > stage.width) left = pin.x - gap - size.width;
  left = Math.max(4, Math.min(left, Math.max(4, stage.width - size.width - 4)));
  const top = Math.max(4, Math.min(pin.y - 12, Math.max(4, stage.height - size.height - 4)));
  return { left, top };
}

/** Point inside a rectangle as 0..1 fractions, clamped; a zero-size rect maps to its centre. */
export function fractionIn(rect: { left: number; top: number; width: number; height: number }, point: { x: number; y: number }): { x: number; y: number } {
  const f = (v: number, o: number, size: number) => (size > 0 ? Math.max(0, Math.min(1, (v - o) / size)) : 0.5);
  return { x: f(point.x, rect.left, rect.width), y: f(point.y, rect.top, rect.height) };
}
