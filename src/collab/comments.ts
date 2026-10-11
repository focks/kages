// Comments anchor to a block id and may carry a suggested patch — the review
// channel between agents and people. A suggested patch is proper JSON Patch the
// block's owner accepts or rejects, which is how an accessibility or brand
// checker proposes a fix without having write access to the block. See
// oracle/collaboration.feature.

import type { PatchOp } from "./patch.ts";

export interface Comment {
  id: string;
  kage: string;
  block: string;
  author: string;
  text: string;
  suggestedPatch?: PatchOp[];
  resolved: boolean;
  createdAt: string;
}

export class CommentThread {
  private comments: Comment[] = [];
  private seq = 0;

  add(c: Omit<Comment, "id" | "resolved" | "createdAt">, createdAt: string): Comment {
    const comment: Comment = { ...c, id: "c" + ++this.seq, resolved: false, createdAt };
    this.comments.push(comment);
    return comment;
  }

  forBlock(kage: string, block: string): Comment[] {
    return this.comments.filter((c) => c.kage === kage && c.block === block);
  }

  resolve(id: string): boolean {
    const c = this.comments.find((x) => x.id === id);
    if (!c) return false;
    c.resolved = true;
    return true;
  }

  all(kage: string): Comment[] {
    return this.comments.filter((c) => c.kage === kage);
  }

  /** Drop every comment on a Kage — used when the Kage is deleted, so they don't
   *  live on orphaned in the snapshot or attach to a later Kage of the same name. */
  purge(kage: string): void {
    this.comments = this.comments.filter((c) => c.kage !== kage);
  }

  /** Serialize/restore for a persistent store. `seq` is reset past the highest
   *  id so a reload never re-mints an existing comment id. */
  dump(): Comment[] {
    return this.comments.map((c) => ({ ...c }));
  }

  load(comments: Comment[]): void {
    this.comments = comments.map((c) => ({ ...c }));
    this.seq = comments.reduce((max, c) => Math.max(max, Number(c.id.replace(/^c/, "")) || 0), 0);
  }
}
