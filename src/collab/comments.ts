// Comments anchor to a block id and may carry a suggested patch — the review
// channel between agents and people. A suggested patch is proper JSON Patch the
// block's owner accepts or rejects, which is how an accessibility or brand
// checker proposes a fix without having write access to the block.
//
// Beyond that single-note shape, a comment can be a reply (a tree, like a forum
// thread), carry a pin position inside its block (a point comment, like a design
// tool's comment mode), take votes, be edited, resolved or deleted. Every added
// field is optional so snapshots written before this existed load unchanged.
// New persisted collections should use src/store/collection.ts; this class predates it and is left as is.
// See oracle/collaboration.feature and oracle/comments.feature.

import type { PatchOp } from "./patch.ts";

export interface Comment {
  id: string;
  kage: string;
  /** The block the comment is about; "" means the Kage as a whole. */
  block: string;
  author: string;
  text: string;
  suggestedPatch?: PatchOp[];
  /** Resolution belongs to a thread's root comment. */
  resolved: boolean;
  createdAt: string;
  /** Reply target. Absent for a thread root. */
  parent?: string;
  /** Where inside the block a pin sits, as 0..1 fractions of the block's box, so
   *  a pin follows its block through responsive layout instead of a pixel offset. */
  pos?: { x: number; y: number };
  /** The head version when it was written, so a pin can say it is from an older one. */
  version?: number;
  editedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  /** A deleted comment with replies stays as a tombstone so the thread keeps its shape. */
  deleted?: boolean;
  /** principal → +1 / -1. Never leaves the server; clients get `score` and `myVote`. */
  votes?: Record<string, 1 | -1>;
}

export class CommentThread {
  private comments: Comment[] = [];
  private seq = 0;

  add(c: Omit<Comment, "id" | "resolved" | "createdAt">, createdAt: string): Comment {
    const comment: Comment = { ...c, id: "c" + ++this.seq, resolved: false, createdAt };
    this.comments.push(comment);
    return comment;
  }

  get(id: string): Comment | undefined { return this.comments.find((c) => c.id === id); }

  forBlock(kage: string, block: string): Comment[] {
    return this.comments.filter((c) => c.kage === kage && c.block === block);
  }

  /** Mark a thread root resolved (or reopen it). Returns false for an unknown id. */
  resolve(id: string, by?: string, resolved = true, at?: string): boolean {
    const c = this.comments.find((x) => x.id === id);
    if (!c) return false;
    c.resolved = resolved;
    if (resolved) { if (by) c.resolvedBy = by; if (at) c.resolvedAt = at; } else { delete c.resolvedBy; delete c.resolvedAt; }
    return true;
  }

  all(kage: string): Comment[] {
    return this.comments.filter((c) => c.kage === kage);
  }

  children(id: string): Comment[] { return this.comments.filter((c) => c.parent === id); }

  /** Nesting depth of a comment (a root is 0), guarded against a corrupt parent cycle. */
  depth(id: string): number {
    let d = 0, cur = this.get(id);
    while (cur?.parent && d < 64) { cur = this.get(cur.parent); d++; }
    return d;
  }

  edit(id: string, text: string, at: string): boolean {
    const c = this.get(id);
    if (!c || c.deleted) return false;
    c.text = text; c.editedAt = at;
    return true;
  }

  /** Delete a comment. With live replies it becomes a tombstone (its text and
   *  author are blanked, its place in the thread kept); without, it disappears —
   *  and a tombstone left childless by that disappears with it. */
  remove(id: string): boolean {
    const c = this.get(id);
    if (!c) return false;
    if (this.children(id).length) { c.deleted = true; c.text = ""; c.author = ""; delete c.suggestedPatch; delete c.votes; return true; }
    this.comments = this.comments.filter((x) => x.id !== id);
    const parent = c.parent && this.get(c.parent);
    if (parent && parent.deleted && !this.children(parent.id).length) this.remove(parent.id);
    return true;
  }

  /** value 0 clears the vote. */
  vote(id: string, who: string, value: 1 | -1 | 0): boolean {
    const c = this.get(id);
    if (!c || c.deleted) return false;
    const votes = { ...(c.votes ?? {}) };
    if (value === 0) delete votes[who]; else votes[who] = value;
    if (Object.keys(votes).length) c.votes = votes; else delete c.votes;
    return true;
  }

  /** Drop every comment on a Kage — used when the Kage is deleted, so they don't
   *  live on orphaned in the snapshot or attach to a later Kage of the same name. */
  purge(kage: string): void {
    this.comments = this.comments.filter((c) => c.kage !== kage);
  }

  /** The id high-water mark, or 0 when the surviving comments already imply it. Persisted by the store
   *  only when ahead of them: deriving it from survivors alone re-minted the ids of deleted newest
   *  comments, and `commentFor` finds comments by id across Kages. Staying 0 otherwise keeps legacy
   *  snapshots round-tripping unchanged. */
  get sequence(): number {
    const survivors = this.comments.reduce((max, c) => Math.max(max, Number(c.id.replace(/^c/, "")) || 0), 0);
    return this.seq > survivors ? this.seq : 0;
  }

  /** Serialize/restore for a persistent store. `seq` never moves backwards, so a reload does not
   *  re-mint an id that was handed out, even one whose comment was since deleted. */
  dump(): Comment[] {
    return this.comments.map((c) => ({ ...c, ...(c.votes ? { votes: { ...c.votes } } : {}) }));
  }

  load(comments: Comment[], sequence = 0): void {
    this.comments = comments.map((c) => ({ ...c }));
    this.seq = comments.reduce((max, c) => Math.max(max, Number(c.id.replace(/^c/, "")) || 0), Number.isSafeInteger(sequence) ? sequence : 0);
  }
}
