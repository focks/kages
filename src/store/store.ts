// @kages/store — the artifactory. Any agent can create a Kage; the store keeps
// it as an immutable, signed version with provenance and hands it to people and
// other agents. Every write validates the result BEFORE committing (atomic, via
// the engine), signs it, records who/how, and emits an event. RBAC is enforced
// here so a reviewer agent physically cannot patch. In-memory reference
// implementation; the interface is what the adapters translate. See
// oracle/artifactory.feature.

import { validate } from "../engine/validate.ts";
import { resolve, systemOf } from "../engine/resolve.ts";
import { systems } from "../engine/data.ts";
import type { KageDoc } from "../engine/types.ts";
import { digest, signDigest, newSigningKey, exportKey, importKey, type SigningKey, type SerializedKey } from "./crypto.ts";
import { applyPatch, type PatchOp } from "../collab/patch.ts";
import { ClaimRegistry } from "../collab/claims.ts";
import { CommentThread, type Comment } from "../collab/comments.ts";
import type {
  VersionRecord, Provenance, Grant, LifecycleState, Visibility, AuditEntry, KageEvent, WriteResult,
} from "./types.ts";

type Clock = () => number; // injected so versions/claims/quotas are deterministic in tests

const LIFECYCLE_NEXT: Record<LifecycleState, LifecycleState[]> = {
  draft: ["review", "published"],
  review: ["published", "draft"],
  published: ["deprecated"],
  deprecated: ["archived"],
  archived: ["published"], // via restore
};

interface Kage {
  name: string;
  versions: VersionRecord[];
}

export interface StoreOptions {
  workspace?: string;
  clock?: Clock;
  /** Versions per principal per rolling hour before a rate-limit error. */
  versionQuotaPerHour?: number;
}

/** The persistable state of a store. Leases (claims) and the quota window are
 *  deliberately NOT included: they are per-process lifetimes, and a lease that
 *  survived a reload would be a crashed agent holding a Kage hostage — the exact
 *  thing TTLs exist to prevent. */
export interface StoreSnapshot {
  workspace: string;
  kages: Array<{ name: string; versions: VersionRecord[] }>;
  grants: Array<[string, Grant[]]>;
  keys: Array<[string, SerializedKey]>;
  audit: AuditEntry[];
  events: KageEvent[];
  comments: Comment[];
}

export class Store {
  readonly workspace: string;
  private clock: Clock;
  private quota: number;
  private kages = new Map<string, Kage>();
  private grants = new Map<string, Set<Grant>>(); // `${principal}@${repo}` -> grants
  private keys = new Map<string, SigningKey>(); // principal -> signing key
  private audit: AuditEntry[] = [];
  private events: KageEvent[] = [];
  private subscribers: Array<(e: KageEvent) => void> = [];
  private writeTimes = new Map<string, number[]>();
  readonly claims = new ClaimRegistry();
  readonly comments = new CommentThread();

  constructor(opts: StoreOptions = {}) {
    this.workspace = opts.workspace ?? "acme";
    this.clock = opts.clock ?? (() => Date.now());
    this.quota = opts.versionQuotaPerHour ?? 120;
  }

  // --- persistence --------------------------------------------------------

  /** Serialize everything durable: versions (with provenance + signatures),
   *  grants, signer keys, audit, events and comments. A persistent backend
   *  writes this to disk and restores it, keeping digests verifiable across
   *  runs (the keys travel with it). */
  snapshot(): StoreSnapshot {
    return {
      workspace: this.workspace,
      kages: [...this.kages.values()].map((k) => ({ name: k.name, versions: k.versions })),
      grants: [...this.grants.entries()].map(([k, set]) => [k, [...set]]),
      keys: [...this.keys.entries()].map(([p, key]) => [p, exportKey(key)]),
      audit: this.audit,
      events: this.events,
      comments: this.comments.dump(),
    };
  }

  static restore(snap: StoreSnapshot, opts: Omit<StoreOptions, "workspace"> = {}): Store {
    const store = new Store({ ...opts, workspace: snap.workspace });
    for (const k of snap.kages) store.kages.set(k.name, { name: k.name, versions: k.versions });
    for (const [key, grants] of snap.grants) store.grants.set(key, new Set(grants));
    for (const [p, sk] of snap.keys) store.keys.set(p, importKey(sk));
    store.audit = snap.audit;
    store.events = snap.events;
    store.comments.load(snap.comments);
    return store;
  }

  // --- identity & permissions ---------------------------------------------

  /** Grant a principal permissions on a repo. An agent gets its OWN grants; an
   *  agent acting onBehalfOf a user is intersected at check time. */
  grant(principal: string, repo: string, grants: Grant[]): void {
    this.grants.set(`${principal}@${repo}`, new Set(grants));
  }

  private has(principal: string, repo: string, grant: Grant): boolean {
    const g = this.grants.get(`${principal}@${repo}`);
    if (!g) return false;
    return g.has(grant) || g.has("admin");
  }

  /** The effective permission for a possibly-delegated write: the INTERSECTION
   *  of the acting agent's grants and the user it acts for. An agent can never
   *  exceed the user's authority by acting "on behalf of" them. */
  private allowed(author: Provenance, repo: string, grant: Grant): boolean {
    if (!this.has(author.principal, repo, grant)) return false;
    if (author.onBehalfOf && !this.has(author.onBehalfOf, repo, grant)) return false;
    return true;
  }

  private signerFor(principal: string): SigningKey {
    let key = this.keys.get(principal);
    if (!key) { key = newSigningKey(principal + "-key"); this.keys.set(principal, key); }
    return key;
  }

  publicKeyOf(principal: string) {
    return this.signerFor(principal).publicKey;
  }

  // --- events & audit ------------------------------------------------------

  subscribe(fn: (e: KageEvent) => void): () => void {
    this.subscribers.push(fn);
    return () => { this.subscribers = this.subscribers.filter((f) => f !== fn); };
  }

  private emit(type: KageEvent["type"], ref: string, data?: Record<string, unknown>): void {
    const e: KageEvent = { type, ref, at: new Date(this.clock()).toISOString(), data };
    this.events.push(e);
    for (const fn of this.subscribers) { try { fn(e); } catch { /* a subscriber must not break a write */ } }
  }

  auditLog(): readonly AuditEntry[] { return this.audit; }
  eventLog(): readonly KageEvent[] { return this.events; }

  private record(principal: string, action: string, ref: string): void {
    this.audit.push({ at: new Date(this.clock()).toISOString(), principal, action, ref });
  }

  // --- quota ---------------------------------------------------------------

  private underQuota(principal: string): boolean {
    const now = this.clock();
    const times = (this.writeTimes.get(principal) ?? []).filter((t) => now - t < 3_600_000);
    this.writeTimes.set(principal, times);
    return times.length < this.quota;
  }

  private tickQuota(principal: string): void {
    const times = this.writeTimes.get(principal) ?? [];
    times.push(this.clock());
    this.writeTimes.set(principal, times);
  }

  // --- write path ----------------------------------------------------------

  /** Create the first version of a Kage. Validates, signs, records provenance,
   *  emits kage.version.created. Private by default. */
  create(repo: string, doc: KageDoc, author: Provenance): WriteResult {
    if (this.kages.has(doc.id)) return err("conflict", `kage '${doc.id}' already exists`);
    return this.writeVersion(repo, doc, author, null, { summary: "create", ops: Object.keys(doc.blocks).length, blocksTouched: Object.keys(doc.blocks) });
  }

  /** Patch the latest version with RFC 6902 ops. The patched result is
   *  validated before commit, so an invalid edit is rejected atomically and the
   *  stored version is untouched. Claimed blocks are honoured. */
  patch(repo: string, name: string, ops: PatchOp[], author: Provenance, summary = "patch"): WriteResult {
    const kage = this.kages.get(name);
    if (!kage) return err("not_found", `no kage '${name}'`);
    const head = kage.versions[kage.versions.length - 1];

    const touched = blocksTouchedBy(ops);
    for (const id of touched) {
      if (!this.claims.canWrite(name, id, author.principal, this.clock()))
        return err("claimed", `block '${id}' is claimed by ${this.claims.claimant(name, id, this.clock())}`);
    }

    let next: KageDoc;
    try { next = applyPatch(head.doc, ops); } catch (e) { return err("invalid_patch", (e as Error).message); }
    return this.writeVersion(repo, next, author, head.ref, { summary, ops: ops.length, blocksTouched: touched });
  }

  private writeVersion(repo: string, doc: KageDoc, author: Provenance, parent: string | null, change: VersionRecord["change"]): WriteResult {
    if (!this.allowed(author, repo, "write")) return err("forbidden", `${author.principal} lacks write on ${repo}`);
    if (!this.underQuota(author.principal)) return err("rate_limited", `${author.principal} exceeded ${this.quota} versions/hour`);

    const v = validate(doc);
    if (!v.ok) return { ok: false, validation: v, error: { code: "invalid_content", msg: `${v.errors.length} validation errors` } };

    const kage = this.kages.get(doc.id) ?? { name: doc.id, versions: [] };
    const vn = kage.versions.length + 1;
    const ref = `kages://${this.workspace}/${repo}/${doc.id}@v${vn}`;
    const resolved = { system: systemOf(doc) + "@" + (systems[systemOf(doc)]?.version ?? ""), blocks: lockfile(doc) };
    const stored: KageDoc = { ...doc, resolved };
    const dgst = digest(stored);
    const signature = signDigest(this.signerFor(author.principal), dgst);

    const record: VersionRecord = {
      ref, parent, name: doc.id, v: vn, digest: dgst, signature,
      createdAt: new Date(this.clock()).toISOString(),
      author, change, resolved,
      validation: { ok: v.ok, errors: v.errors.length, warnings: v.warnings.length },
      state: "draft", visibility: "private", doc: stored,
    };
    kage.versions.push(record);
    this.kages.set(doc.id, kage);
    this.tickQuota(author.principal);
    this.record(author.principal, parent ? "patch" : "create", ref);
    this.emit("kage.version.created", ref);
    return { ok: true, version: record, validation: v };
  }

  // --- lifecycle -----------------------------------------------------------

  private transition(name: string, to: LifecycleState, principal: string, repo: string, needed: Grant): WriteResult {
    const head = this.head(name);
    if (!head) return err("not_found", `no kage '${name}'`);
    if (!this.has(principal, repo, needed)) return err("forbidden", `${principal} lacks ${needed} on ${repo}`);
    if (!LIFECYCLE_NEXT[head.state].includes(to)) return err("bad_state", `cannot go ${head.state} -> ${to}`);
    head.state = to;
    this.record(principal, to, head.ref);
    this.emit("kage.state.changed", head.ref, { to });
    return { ok: true, version: head };
  }

  /** Publish the head version: requires `publish`, and the version must be
   *  validation-clean (an agent may publish only a passing version). */
  publish(repo: string, name: string, principal: string, visibility: Visibility = "private"): WriteResult {
    const head = this.head(name);
    if (!head) return err("not_found", `no kage '${name}'`);
    if (!head.validation.ok) return err("invalid_content", "cannot publish a version with validation errors");
    const r = this.transition(name, "published", principal, repo, "publish");
    if (r.ok && r.version) { r.version.visibility = visibility; this.emit("kage.published", r.version.ref); }
    return r;
  }

  submitForReview(repo: string, name: string, principal: string): WriteResult { return this.transition(name, "review", principal, repo, "write"); }
  deprecate(repo: string, name: string, principal: string): WriteResult { return this.transition(name, "deprecated", principal, repo, "write"); }
  archive(repo: string, name: string, principal: string): WriteResult { return this.transition(name, "archived", principal, repo, "admin"); }

  // --- read / search / export ---------------------------------------------

  head(name: string): VersionRecord | undefined {
    const k = this.kages.get(name);
    return k ? k.versions[k.versions.length - 1] : undefined;
  }

  getVersion(name: string, v: number): VersionRecord | undefined {
    return this.kages.get(name)?.versions.find((x) => x.v === v);
  }

  /** Every version of a Kage, oldest first — the revision history a dashboard shows. */
  versions(name: string): readonly VersionRecord[] {
    return this.kages.get(name)?.versions ?? [];
  }

  /** The head version of every Kage, for a listing/dashboard view. */
  list(): VersionRecord[] {
    return [...this.kages.values()].map((k) => k.versions[k.versions.length - 1]);
  }

  /** Full-text over title + block text + meta, with structured filters. */
  search(query: { text?: string; system?: string; author?: string; state?: LifecycleState }): VersionRecord[] {
    const hay = (r: VersionRecord) => JSON.stringify(r.doc).toLowerCase() + " " + r.doc.title.toLowerCase();
    return [...this.kages.values()]
      .map((k) => k.versions[k.versions.length - 1])
      .filter((r) =>
        (!query.text || hay(r).includes(query.text.toLowerCase())) &&
        (!query.system || systemOf(r.doc) === query.system) &&
        (!query.author || r.author.principal === query.author) &&
        (!query.state || r.state === query.state));
  }

  /** A listing card for a Kage — what a UI or an agent's context shows. */
  card(name: string) {
    const r = this.head(name);
    if (!r) return null;
    return { ref: r.ref, title: r.doc.title, system: systemOf(r.doc), blocks: Object.keys(r.doc.blocks).length, lastAuthor: r.author.principal, state: r.state };
  }

  /** Export the document plus its lockfile as JSON (the re-importable form). */
  exportJSON(name: string): string | null {
    const r = this.head(name);
    return r ? JSON.stringify(r.doc, null, 2) : null;
  }

  /** Import re-validates before accepting — an imported doc is untrusted. */
  importJSON(repo: string, json: string, author: Provenance): WriteResult {
    let doc: KageDoc;
    try { doc = JSON.parse(json); } catch (e) { return err("invalid_content", (e as Error).message); }
    return this.create(repo, doc, author);
  }

  // --- collaboration surface ----------------------------------------------

  comment(kage: string, block: string, author: string, text: string, suggestedPatch?: PatchOp[]): Comment {
    const c = this.comments.add({ kage, block, author, text, suggestedPatch }, new Date(this.clock()).toISOString());
    this.emit("kage.comment.created", kage, { block, commentId: c.id });
    return c;
  }
}

function err(code: string, msg: string): WriteResult { return { ok: false, error: { code, msg } }; }

/** The set of block ids an op list touches (for provenance + claim checks). */
function blocksTouchedBy(ops: PatchOp[]): string[] {
  const ids = new Set<string>();
  for (const op of ops) {
    const m = /^\/blocks\/([a-zA-Z0-9_-]+)/.exec(op.path);
    if (m) ids.add(m[1]);
    if (op.op === "move" && op.from) { const fm = /^\/blocks\/([a-zA-Z0-9_-]+)/.exec(op.from); if (fm) ids.add(fm[1]); }
  }
  return [...ids];
}

/** The resolved implementation ref for every block — the version's lockfile, so
 *  the viewer loads EXACTLY these bundles and publishing never breaks old Kages. */
function lockfile(doc: KageDoc): Record<string, string> {
  const sysId = systemOf(doc);
  const out: Record<string, string> = {};
  for (const id of Object.keys(doc.blocks)) {
    const r = resolve(sysId, doc.blocks[id].type);
    if (r.ref) out[id] = r.ref;
  }
  return out;
}
