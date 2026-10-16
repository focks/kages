// The pattern for a new workspace-scoped, store-persisted record type (briefs,
// critiques, …). Comments proved the shape: an optional snapshot field, a
// tolerant load, ids that are never re-minted after a reload, and purge when the
// owning Kage is deleted. This holds those rules once so each new collection
// does not re-derive them. CommentThread is deliberately NOT migrated onto it.

export type CollectionError = { ok: false; code: "limit_reached"; error: string };

export interface CollectionOptions<T> {
  /** Id prefix, e.g. "q" → q1, q2. */
  prefix: string;
  /** Hard cap on rows; add() returns an error instead of silently dropping. */
  max?: number;
  /** Not used by the helper itself; documents which field ties a row to a Kage. */
  keyOf?: (row: T) => string | undefined;
}

export class Collection<T extends { id: string }> {
  private rows: T[] = [];
  private seq = 0;
  private prefix: string;
  private max: number;

  constructor(opts: CollectionOptions<T>) {
    this.prefix = opts.prefix;
    this.max = opts.max ?? Infinity;
  }

  add(row: Omit<T, "id">): T | CollectionError {
    if (this.rows.length >= this.max) return { ok: false, code: "limit_reached", error: `at most ${this.max} rows` };
    const created = { ...row, id: `${this.prefix}${++this.seq}` } as T;
    this.rows.push(created);
    return created;
  }

  get(id: string): T | undefined { return this.rows.find((r) => r.id === id); }
  all(): T[] { return [...this.rows]; }
  where(pred: (row: T) => boolean): T[] { return this.rows.filter(pred); }

  /** Shallow-merge; the id can never change. Returns the new row. */
  update(id: string, patch: Partial<Omit<T, "id">>): T | undefined {
    const i = this.rows.findIndex((r) => r.id === id);
    if (i < 0) return undefined;
    this.rows[i] = { ...this.rows[i], ...patch, id } as T;
    return this.rows[i];
  }

  remove(id: string): boolean {
    const i = this.rows.findIndex((r) => r.id === id);
    if (i < 0) return false;
    this.rows.splice(i, 1);
    return true;
  }

  /** e.g. purge every row of a deleted Kage. Returns how many were removed. */
  purgeWhere(pred: (row: T) => boolean): number {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !pred(r));
    return before - this.rows.length;
  }

  /** Deep copy: callers mutating the dump must not mutate the store. */
  dump(): T[] { return JSON.parse(JSON.stringify(this.rows)) as T[]; }

  /** Tolerant: `undefined` (a snapshot from before this collection existed) is
   *  an empty collection. The id counter is reseeded from the highest existing
   *  suffix and an independently persisted high-water mark prevents reuse after deletion. */
  get sequence(): number { return this.seq; }

  load(rows: T[] | undefined, sequence = 0): void {
    this.rows = rows ? (JSON.parse(JSON.stringify(rows)) as T[]) : [];
    let max = 0;
    for (const r of this.rows) {
      if (!r.id.startsWith(this.prefix)) continue;
      const n = Number(r.id.slice(this.prefix.length));
      if (Number.isInteger(n) && n > max) max = n;
    }
    this.seq = Math.max(this.seq, max, sequence);
  }
}

export const isCollectionError = (x: unknown): x is CollectionError =>
  typeof x === "object" && x !== null && (x as { ok?: unknown }).ok === false && (x as { code?: unknown }).code === "limit_reached";
