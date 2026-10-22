// @kages/store — the artifactory. Any agent can create a Kage; the store keeps
// it as an immutable, signed version with provenance and hands it to people and
// other agents. Every write validates the result BEFORE committing (atomic, via
// the engine), signs it, records who/how, and emits an event. RBAC is enforced
// here so a reviewer agent physically cannot patch. In-memory reference
// implementation; the interface is what the adapters translate. See
// oracle/artifactory.feature.

import { validate } from "../engine/validate.ts";
import type { ValidateResult } from "../engine/types.ts";
import { resolve, systemOf } from "../engine/resolve.ts";
import { systems } from "../engine/data.ts";
import type { KageDoc } from "../engine/types.ts";
import { clone } from "../engine/expr.ts";
import { randomUUID } from "node:crypto";
import { digest, signDigest, newSigningKey, exportKey, importKey, type SigningKey, type SerializedKey } from "./crypto.ts";
import { applyPatch, checkPatchOps, type PatchOp } from "../collab/patch.ts";
import { mergeThreeWay } from "../collab/merge.ts";
import { ClaimRegistry } from "../collab/claims.ts";
import { CommentThread, type Comment } from "../collab/comments.ts";
import { Collection, isCollectionError } from "./collection.ts";
import assets from "../../public/ds/assets.json" with { type: "json" };
import { mergeBrief, validateBrief, type WorkspaceBriefRecord } from "./brief.ts";
import { resolveDesign, validateDesign, readSnapshot, type DesignSnapshot } from "../engine/design.ts";
import { MAX_DESIGNS, type DesignRecord } from "./designs.ts";
import { PROJECT_NAME, type ProjectCount } from "./projects.ts";
import type {
  VersionRecord, Provenance, Grant, LifecycleState, Visibility, AuditEntry, KageEvent, WriteResult,
} from "./types.ts";

type Clock = () => number; // injected so versions/claims/quotas are deterministic in tests

// The editorial forward path is draft → review → published → deprecated, but
// archiving is "put it away" and must be reachable from any live state, and a
// published Kage can be pulled back to draft (unpublish) or restored from the
// archive. Deletion is NOT a state — it removes the Kage entirely (see remove()).
const LIFECYCLE_NEXT: Record<LifecycleState, LifecycleState[]> = {
  draft: ["review", "published", "archived"],
  review: ["draft", "published", "archived"],
  published: ["draft", "deprecated", "archived"], // draft = unpublish
  deprecated: ["published", "archived"],
  archived: ["draft", "published"], // restore
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

/** Leases retain absolute expiry times across CAS restores; reloading must not
 * let a competing writer bypass an active claim. */
export interface StoreSnapshot {
  workspace: string;
  kages: Array<{ name: string; versions: VersionRecord[] }>;
  grants: Array<[string, Grant[]]>;
  keys: Array<[string, SerializedKey]>;
  audit: AuditEntry[];
  events: KageEvent[];
  comments: Comment[];
  /** At most one record; optional so snapshots from before briefs existed still load. */
  briefs?: WorkspaceBriefRecord[];
  /** Workspace designs; optional so snapshots from before designs existed still load. */
  designs?: DesignRecord[];
  /** The project registry — names that exist even with no Kage in them. Optional so
   *  snapshots from before projects existed still load (they restore an empty registry). */
  projects?: string[];
  /** Per-Kage extra project membership (beyond the home repo). Optional for the same
   *  back-compat reason; `[kageName, [project, …]]`. */
  memberships?: Array<[string, string[]]>;
  /** Last comment id number handed out; absent in snapshots written before it was persisted. */
  commentSequence?: number;
  claims?: import("../collab/claims.ts").Claim[];
  /** Rolling hourly counters (version writes and comments, per principal), kept with the data they limit:
   *  a persistent deployment restores a fresh Store per request, so counters held only in memory enforce nothing. */
  limits?: { writes: Array<[string, number[]]>; comments: Array<[string, number[]]>; discussion?: Array<[string, number[]]> };
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
  private brief: WorkspaceBriefRecord | null = null;
  private designs = new Map<string, DesignRecord>();
  /** Project names that exist in this workspace, so an empty project still shows in the
   *  sidebar. The home repo of every Kage is a project too (unioned in at read time),
   *  but only names created explicitly need storing — a repo is implied by its Kages. */
  private projects = new Set<string>();
  /** A Kage's EXTRA projects beyond its home repo, keyed by Kage name. The home repo is
   *  never stored here (it is always implicit), so a value here is purely additive. */
  private memberships = new Map<string, Set<string>>();
  /** Dry-run timestamps per workspace and principal. Process-wide on purpose: a persistent deployment
   *  restores a fresh Store from the snapshot on every request, so an instance field would start each
   *  request at zero and enforce nothing. A dry run must stay a read (committing a counter would turn it
   *  into a write), so this is a per-server-process brake against hammering the checker, not an
   *  exact account: on several instances each keeps its own count. */
  private static dryRunTimes = new Map<string, number[]>();
  /** Forget every dry-run count (tests share one process, so a limit test must not poison the next). */
  static resetDryRunLimits(): void { Store.dryRunTimes.clear(); }

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
      ...(this.comments.sequence ? { commentSequence: this.comments.sequence } : {}),
      briefs: this.brief ? [JSON.parse(JSON.stringify(this.brief))] : [],
      ...(this.designs.size ? { designs: [...this.designs.values()].map((d) => JSON.parse(JSON.stringify(d))) } : {}),
      // Omitted when empty, so a workspace that never used projects writes the same snapshot it always did.
      ...(this.projects.size ? { projects: [...this.projects] } : {}),
      ...(this.memberships.size ? { memberships: [...this.memberships.entries()].map(([name, set]) => [name, [...set]] as [string, string[]]) } : {}),
      claims: this.claims.dump(),
      ...this.limitsSnapshot(),
    };
  }

  /** Omitted when nothing is inside the window, so an idle workspace's snapshot is unchanged. */
  private limitsSnapshot(): Pick<StoreSnapshot, "limits"> {
    const writes = this.recentTimes(this.writeTimes), comments = this.recentTimes(this.commentTimes), discussion = this.recentTimes(this.discussionTimes);
    return writes.length || comments.length || discussion.length ? { limits: { writes, comments, ...(discussion.length ? { discussion } : {}) } } : {};
  }

  /** Timestamps still inside the one-hour window, so a snapshot never carries history it can no longer use. */
  private recentTimes(m: Map<string, number[]>): Array<[string, number[]]> {
    const now = this.clock();
    return [...m.entries()].map(([k, ts]) => [k, ts.filter((t) => now - t < 3_600_000)] as [string, number[]]).filter(([, ts]) => ts.length);
  }

  static restore(snap: StoreSnapshot, opts: Omit<StoreOptions, "workspace"> = {}): Store {
    const store = new Store({ ...opts, workspace: snap.workspace });
    for (const k of snap.kages) {
      // Backfill uuids for snapshots taken before uuids existed: mint one per
      // Kage and stamp every version, so old data gets stable share links and
      // round-trips with the uuid on the next save.
      if (k.versions.length && !k.versions[0].uuid) {
        const u = randomUUID();
        for (const v of k.versions) v.uuid = u;
      }
      store.kages.set(k.name, { name: k.name, versions: k.versions });
    }
    for (const [key, grants] of snap.grants) store.grants.set(key, new Set(grants));
    for (const [p, sk] of snap.keys) store.keys.set(p, importKey(sk));
    store.audit = snap.audit;
    store.events = snap.events;
    store.comments.load(snap.comments, snap.commentSequence);
    store.brief = snap.briefs?.[0] ? JSON.parse(JSON.stringify(snap.briefs[0])) : null;
    for (const d of snap.designs ?? []) store.designs.set(d.id, JSON.parse(JSON.stringify(d)));
    for (const name of snap.projects ?? []) store.projects.add(name);
    for (const [name, list] of snap.memberships ?? []) store.memberships.set(name, new Set(list));
    store.claims.load(snap.claims);
    for (const [p, ts] of snap.limits?.writes ?? []) store.writeTimes.set(p, [...ts]);
    for (const [p, ts] of snap.limits?.comments ?? []) store.commentTimes.set(p, [...ts]);
    for (const [p, ts] of snap.limits?.discussion ?? []) store.discussionTimes.set(p, [...ts]);
    return store;
  }

  // --- identity & permissions ---------------------------------------------

  /** Grant a principal permissions on a repo. An agent gets its OWN grants; an
   *  agent acting onBehalfOf a user is intersected at check time. */
  grant(principal: string, repo: string, grants: Grant[]): void {
    this.grants.set(`${principal}@${repo}`, new Set(grants));
  }

  /** Does anyone hold any grant on this repo? Used to detect an UNCLAIMED
   *  project, so the first creator can be made its owner (see create). */
  private hasAnyGrant(repo: string): boolean {
    for (const key of this.grants.keys()) if (key.endsWith(`@${repo}`)) return true;
    return false;
  }

  /** The repo (project) a stored ref lives in — public so adapters can group a
   *  listing by project without re-parsing the ref themselves. */
  repoOf(ref: string): string { return Store.repoOfRef(ref); }

  /** Resolve a Kage's stable uuid to its name. Linear scan — fine at authoring
   *  scale; add an index only if a store ever holds enough Kages to matter. */
  nameByUuid(uuid: string): string | undefined {
    for (const kage of this.kages.values()) if (kage.versions[0]?.uuid === uuid) return kage.name;
    return undefined;
  }

  /** Does a Kage with this name/id exist? Used to pick a free id when cloning. */
  exists(name: string): boolean { return this.kages.has(name); }

  /** The workspace this store namespaces. Workspace → project (repo) → Kage is
   *  the organizing hierarchy, and every ref encodes all three. */
  get workspaceName(): string { return this.workspace; }

  /** Projects in this workspace: each repo that holds at least one Kage, with a
   *  count. Derived from the head of every Kage, so it reflects moves/deletes. */
  listRepos(): { repo: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const kage of this.kages.values()) {
      const head = kage.versions[kage.versions.length - 1];
      if (!head) continue;
      const repo = Store.repoOfRef(head.ref);
      counts.set(repo, (counts.get(repo) ?? 0) + 1);
    }
    return [...counts.entries()].map(([repo, count]) => ({ repo, count })).sort((a, b) => a.repo.localeCompare(b.repo));
  }

  private has(principal: string, repo: string, grant: Grant): boolean {
    const g = this.grants.get(`${principal}@${repo}`);
    if (!g) return false;
    if (g.has("admin") || g.has(grant)) return true;
    // Anyone who can act on the repo can also read it — write/review/publish
    // all imply read, so a writer isn't locked out of its own resource.
    return grant === "read" && (g.has("write") || g.has("review") || g.has("publish"));
  }

  /** The effective permission for a possibly-delegated write: the INTERSECTION
   *  of the acting agent's grants and the user it acts for. An agent can never
   *  exceed the user's authority by acting "on behalf of" them. */
  private allowed(author: Provenance, repo: string, grant: Grant): boolean {
    if (!this.has(author.principal, repo, grant)) return false;
    if (author.onBehalfOf && !this.has(author.onBehalfOf, repo, grant)) return false;
    return true;
  }

  /** The repo a stored Kage lives in — parsed from its own ref, never trusted
   *  from the caller. `kages://<ws>/<repo>/<name>@vN`. Permission checks bind to
   *  THIS, so a grant on repo A can't be used to touch a resource in repo B. */
  private static repoOfRef(ref: string): string {
    return ref.replace(/^kages:\/\//, "").split("/")[1] ?? "";
  }

  /** Can this principal READ this version? Repo readers see everything in the
   *  repo; everyone else sees only published link/public versions. A private or
   *  draft Kage is invisible to a principal without a read grant. */
  canAccess(record: VersionRecord, author: Provenance): boolean {
    const repo = Store.repoOfRef(record.ref);
    if (this.allowed(author, repo, "read")) return true;
    return record.state === "published" && (record.visibility === "link" || record.visibility === "public");
  }

  /** Resolve a readable version or a structured denial — the gate every read
   *  operation goes through, so visibility is enforced in the store, not the UI. */
  authorizeRead(name: string, author: Provenance, version?: number): { ok: true; record: VersionRecord } | { ok: false; code: string; msg: string } {
    const record = version ? this.getVersion(name, version) : this.head(name);
    if (!record) return { ok: false, code: "not_found", msg: `no kage '${name}'` };
    if (!this.canAccess(record, author)) return { ok: false, code: "forbidden", msg: `${author.principal} cannot read '${name}'` };
    // An older version is readable only while the CURRENT sharing decision also allows it. Without this,
    // a version that was public once stayed readable after the head went private or was unpublished (the
    // share link follows the head, so should this), and a draft kept private is not exposed by a later
    // version being published. Readers with a grant on the repo pass both checks.
    if (version) {
      const head = this.head(name)!;
      if (head !== record && !this.canAccess(head, author)) return { ok: false, code: "forbidden", msg: `${author.principal} cannot read '${name}'` };
    }
    return { ok: true, record };
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

  /** May this caller see this event? An event names a Kage (its ref) and often a block or comment id, so it
   *  is exactly as sensitive as reading that Kage: a caller who is refused `get_kage` must not learn from
   *  the stream that it exists, what it is called, or that someone commented on it. A deleted Kage can no
   *  longer be checked against its visibility, so only readers of its repo see it go; workspace-level events
   *  (the brief) are for people with read access to something in the workspace. */
  canSeeEvent(e: KageEvent, author: Provenance): boolean {
    const m = /^kages:\/\/[^/]+\/([^/@]+)\/([^@]+)@v\d+$/.exec(e.ref);
    const name = m ? m[2] : e.ref.includes("://") ? undefined : e.ref;
    if (name && this.kages.has(name)) return this.authorizeRead(name, author).ok;
    if (m) return this.allowed(author, m[1], "read");
    if (e.ref.includes("://")) {
      for (const key of this.grants.keys()) { const at = key.lastIndexOf("@"); if (key.slice(0, at) === author.principal && this.allowed(author, key.slice(at + 1), "read")) return true; }
    }
    return false;
  }

  private record(principal: string, action: string, ref: string): void {
    this.audit.push({ at: new Date(this.clock()).toISOString(), principal, action, ref });
  }

  /** Rows that reference a Kage which no longer exists (a snapshot edited by hand, or a delete that
   *  predates purge-on-delete). Read-only; `pruneOrphans` removes them. */
  orphans(): { comments: number } {
    return { comments: this.comments.dump().filter((c) => !this.kages.has(c.kage)).length };
  }
  pruneOrphans(): { comments: number } {
    const found = this.orphans();
    for (const name of new Set(this.comments.dump().filter((c) => !this.kages.has(c.kage)).map((c) => c.kage))) this.comments.purge(name);
    return found;
  }

  // --- workspace brief ------------------------------------------------------

  /** Permissions are per repo and a workspace has no role of its own, so the
   *  brief borrows them: any grant on any repo means "member", `admin` on any
   *  repo means "workspace admin". An agent acting for a user is intersected with
   *  that user, exactly as for repo grants. */
  private workspaceHolds(principal: string, grant?: Grant): boolean {
    for (const [key, set] of this.grants) if (key.startsWith(principal + "@") && key.length > principal.length + 1 && (!grant || set.has(grant))) return true;
    return false;
  }
  private workspaceAllows(author: Provenance, grant?: Grant): boolean {
    if (!this.workspaceHolds(author.principal, grant)) return false;
    return !author.onBehalfOf || this.workspaceHolds(author.onBehalfOf, grant);
  }

  getBrief(author: Provenance): BriefResult<{ record: WorkspaceBriefRecord | null }> {
    if (!this.workspaceAllows(author)) return berr("forbidden", `${author.principal} has no access to this workspace`);
    return { ok: true, value: { record: this.brief ? JSON.parse(JSON.stringify(this.brief)) : null } };
  }

  /** Replace (or, with `merge`, update) the brief. `baseRevision` makes it
   *  optimistic: a stale writer gets a conflict carrying the winner's record
   *  instead of silently overwriting it. */
  setBrief(input: unknown, author: Provenance, opts: { baseRevision?: number; merge?: boolean } = {}): BriefResult<{ record: WorkspaceBriefRecord; warnings: string[] }> {
    if (!this.workspaceAllows(author, "admin")) return berr("forbidden", `${author.principal} needs admin on a project to edit the workspace brief`);
    const current = this.brief;
    if (opts.baseRevision !== undefined && opts.baseRevision !== (current?.revision ?? 0))
      return berr("conflict", `the brief is at revision ${current?.revision ?? 0}, not ${opts.baseRevision}`, current ? JSON.parse(JSON.stringify(current)) : null);
    const checked = validateBrief(opts.merge ? mergeBrief(current?.brief, input) : input);
    if (!checked.ok) return berr("invalid_brief", checked.errors.join("; "));
    const record: WorkspaceBriefRecord = { id: "brief", brief: checked.brief, revision: (current?.revision ?? 0) + 1, updatedAt: new Date(this.clock()).toISOString(), updatedBy: author.principal };
    this.brief = record;
    const ref = `kages://${this.workspace}/brief`;
    this.record(author.principal, "brief.set", ref);
    this.emit("workspace.brief.updated", ref, { revision: record.revision });
    return { ok: true, value: { record: JSON.parse(JSON.stringify(record)), warnings: checked.warnings } };
  }

  // --- workspace designs ---------------------------------------------------

  /** Members read designs (a Kage in the workspace renders with one); admins write them, as for the brief. */
  listDesigns(author: Provenance): BriefResult<{ designs: DesignRecord[] }> {
    if (!this.workspaceAllows(author)) return berr("forbidden", `${author.principal} has no access to this workspace`);
    return { ok: true, value: { designs: [...this.designs.values()].sort((a, b) => a.id.localeCompare(b.id)).map((d) => JSON.parse(JSON.stringify(d))) } };
  }

  getDesign(id: string, author: Provenance): BriefResult<{ record: DesignRecord }> {
    if (!this.workspaceAllows(author)) return berr("forbidden", `${author.principal} has no access to this workspace`);
    const rec = this.designs.get(id);
    return rec ? { ok: true, value: { record: JSON.parse(JSON.stringify(rec)) } } : berr("not_found", `no design '${id}'`);
  }

  /** Create or replace a design. `baseRevision` (0 = must not exist yet) makes it optimistic, like the brief.
   *  Making one the default clears the flag on the rest, so there is never more than one. */
  setDesign(input: unknown, author: Provenance, opts: { baseRevision?: number; default?: boolean } = {}): BriefResult<{ record: DesignRecord; snapshot: DesignSnapshot }> {
    if (!this.workspaceAllows(author, "admin")) return berr("forbidden", `${author.principal} needs admin on a project to edit workspace designs`);
    const checked = validateDesign(input);
    if (!checked.ok) return berr("invalid_design", checked.errors.join("; "));
    const def = checked.design;
    const current = this.designs.get(def.id);
    if (opts.baseRevision !== undefined && opts.baseRevision !== (current?.revision ?? 0))
      return berr("conflict", `design '${def.id}' is at revision ${current?.revision ?? 0}, not ${opts.baseRevision}`);
    if (!current && this.designs.size >= MAX_DESIGNS) return berr("limit_reached", `a workspace holds at most ${MAX_DESIGNS} designs`);
    const makeDefault = opts.default !== undefined ? opts.default : !!current?.default;
    if (makeDefault) for (const d of this.designs.values()) d.default = false;
    const record: DesignRecord = { id: def.id, def, revision: (current?.revision ?? 0) + 1, ...(makeDefault ? { default: true } : {}), updatedAt: new Date(this.clock()).toISOString(), updatedBy: author.principal };
    this.designs.set(def.id, record);
    const ref = `kages://${this.workspace}/designs/${def.id}`;
    this.record(author.principal, "design.set", ref);
    this.emit("workspace.design.updated", ref, { revision: record.revision });
    return { ok: true, value: { record: JSON.parse(JSON.stringify(record)), snapshot: resolveDesign(def) } };
  }

  /** Kages keep the snapshot their version pinned, so deleting a design never breaks one; it only stops being offered. */
  deleteDesign(id: string, author: Provenance): BriefResult<{ id: string }> {
    if (!this.workspaceAllows(author, "admin")) return berr("forbidden", `${author.principal} needs admin on a project to delete workspace designs`);
    if (!this.designs.delete(id)) return berr("not_found", `no design '${id}'`);
    const ref = `kages://${this.workspace}/designs/${id}`;
    this.record(author.principal, "design.delete", ref);
    this.emit("workspace.design.updated", ref, { deleted: true });
    return { ok: true, value: { id } };
  }

  private defaultDesignId(): string | undefined {
    for (const d of this.designs.values()) if (d.default) return d.id;
    return undefined;
  }

  // --- projects (an additive, organizational membership layer) --------------
  // A project is NOT part of a Kage's signed identity. The home `repo` in the
  // ref is untouched; these methods only record which extra projects a Kage is
  // tagged into, and which project names exist. Reads still go through the home
  // repo, so a project tag grants nobody anything.

  /** A Kage's home repo — its signed identity, parsed from the head ref. The one
   *  project it is always in, implicit and unremovable. */
  private homeRepoOf(name: string): string | undefined {
    const head = this.head(name);
    return head ? Store.repoOfRef(head.ref) : undefined;
  }

  /** Every project a Kage is in: its home repo unioned with its extra memberships.
   *  What a card shows; the home repo comes first so the identity reads first. */
  projectsOf(name: string): string[] {
    const home = this.homeRepoOf(name);
    if (home === undefined) return [];
    const extra = [...(this.memberships.get(name) ?? [])].filter((p) => p !== home).sort();
    return [home, ...extra];
  }

  /** Register a project name so an empty project persists and lists. Creating a project
   *  is a workspace-level act (like editing the brief), not a write on any one repo, so
   *  it needs workspace membership — any grant on any repo. Idempotent: re-creating an
   *  existing name is a no-op success, not a conflict. */
  createProject(name: string, author: Provenance): BriefResult<{ project: string }> {
    if (!this.workspaceAllows(author)) return berr("forbidden", `${author.principal} has no access to this workspace`);
    if (typeof name !== "string" || !PROJECT_NAME.test(name)) return berr("invalid_name", "a project name is 1–64 chars of a–z, 0–9 and -, starting with a letter or digit");
    this.projects.add(name);
    const ref = `kages://${this.workspace}/projects/${name}`;
    this.record(author.principal, "project.create", ref);
    this.emit("workspace.project.updated", ref, { created: true });
    return { ok: true, value: { project: name } };
  }

  /** The workspace's projects with a readable-Kage count. The set listed is the union of
   *  the registry (so empty projects appear) and every home repo (so a project is never
   *  hidden just because it was never explicitly created). Counts and visibility match
   *  `list_repos`: a Kage counts for a project only if THIS caller may read it, and a
   *  project with nothing readable still appears with count 0 if it is in the registry. */
  listProjects(author: Provenance): ProjectCount[] {
    const counts = new Map<string, number>();
    for (const name of this.projects) counts.set(name, 0); // registry entries appear even when empty
    for (const kage of this.kages.values()) {
      const head = kage.versions[kage.versions.length - 1];
      if (!head || !this.canAccess(head, author)) continue;
      for (const project of this.projectsOf(kage.name)) counts.set(project, (counts.get(project) ?? 0) + 1);
    }
    return [...counts.entries()].map(([project, count]) => ({ project, count })).sort((a, b) => a.project.localeCompare(b.project));
  }

  /** Set a Kage's extra project membership. The home repo is implicit and cannot be set
   *  or removed here, so it is subtracted out before storing — membership is purely the
   *  projects BEYOND home. Changing where a Kage is organized is a write on its content's
   *  home repo (the resource), intersected with onBehalfOf exactly like a patch, so a
   *  project tag can never be the back door a write grant is not. */
  setKageProjects(name: string, projects: string[], author: Provenance): BriefResult<{ name: string; projects: string[] }> {
    const home = this.homeRepoOf(name);
    if (home === undefined) return berr("not_found", `no kage '${name}'`);
    if (!this.allowed(author, home, "write")) return berr("forbidden", `${author.principal} lacks write on ${home}`);
    if (!Array.isArray(projects)) return berr("invalid_name", "projects must be a list of project names");
    for (const p of projects) if (typeof p !== "string" || !PROJECT_NAME.test(p)) return berr("invalid_name", `'${p}' is not a valid project name`);
    const extra = new Set(projects.filter((p) => p !== home));
    // Named projects join the registry, so a Kage tagged into a not-yet-created project
    // makes that project real (and listable) rather than silently vanishing on reload.
    for (const p of extra) this.projects.add(p);
    if (extra.size) this.memberships.set(name, extra);
    else this.memberships.delete(name); // no extra projects: drop the entry entirely, so an empty set adds nothing to a snapshot
    const ref = `kages://${this.workspace}/${home}/${name}`;
    this.record(author.principal, "project.membership", ref);
    this.emit("workspace.project.updated", ref, { projects: this.projectsOf(name) });
    return { ok: true, value: { name, projects: this.projectsOf(name) } };
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
   *  emits kage.version.created. Private by default. Authorized before any work. */
  create(repo: string, doc: KageDoc, author: Provenance): WriteResult {
    // First-creator-owns-the-project: creating into an UNCLAIMED repo makes you
    // its admin, the way opening a new namespace works elsewhere. A repo that
    // already has grants is governed by them — you can't create into someone
    // else's project. ponytail: open claiming; gate repo creation in production.
    if (!this.hasAnyGrant(repo)) this.grant(author.principal, repo, ["write", "review", "publish", "admin"]);
    if (!this.allowed(author, repo, "write")) return err("forbidden", `${author.principal} lacks write on ${repo}`);
    if (this.kages.has(doc.id)) return err("conflict", `kage '${doc.id}' already exists`);
    return this.writeVersion(repo, doc, author, null, { summary: "create", ops: Object.keys(doc.blocks).length, blocksTouched: Object.keys(doc.blocks) });
  }

  /** Patch the latest version with RFC 6902 ops. The repo is the RESOURCE's own
   *  repo (parsed from its ref), and authorization + claim checks happen BEFORE
   *  the patch is applied — a forbidden caller never reaches applyPatch, so it
   *  can't trip a side effect on the way to a denial. With `baseVersion`, an edit
   *  made against an older version is three-way merged against head and conflicts
   *  are reported rather than silently overwriting a concurrent save. */
  patch(name: string, ops: PatchOp[], author: Provenance, opts: { baseVersion?: number; summary?: string; kind?: string } = {}): WriteResult {
    const kage = this.kages.get(name);
    if (!kage) return err("not_found", `no kage '${name}'`);
    const head = kage.versions[kage.versions.length - 1];
    const repo = Store.repoOfRef(head.ref);

    if (!this.allowed(author, repo, "write")) return err("forbidden", `${author.principal} lacks write on ${repo}`);

    const { blockIds, structural } = touchedBy(ops, head.doc);
    const blocked = this.claimBlock(name, blockIds, structural, author);
    if (blocked) return err("claimed", blocked.msg);

    const planned = this.candidateOf(name, head, ops, opts.baseVersion);
    if (!planned.ok) return err(planned.code, planned.msg);

    return this.writeVersion(repo, planned.doc, author, head.ref, { summary: opts.summary ?? "patch", ops: ops.length, blocksTouched: blockIds, ...(opts.kind ? { kind: opts.kind } : {}) });
  }

  /** The first claim that stops this author from touching these blocks, if any. A
   *  structural edit (anything outside /blocks) needs the claim on `root`, or a
   *  wholesale /blocks replace would slip past a block-level claim. */
  private claimBlock(name: string, blockIds: string[], structural: boolean, author: Provenance): { block: string; msg: string } | null {
    if (structural && !this.claims.canWrite(name, "root", author.principal, this.clock()))
      return { block: "root", msg: `structural edit needs a free claim on 'root' (held by ${this.claims.claimant(name, "root", this.clock())})` };
    for (const id of blockIds)
      if (!this.claims.canWrite(name, id, author.principal, this.clock()))
        return { block: id, msg: `block '${id}' is claimed by ${this.claims.claimant(name, id, this.clock())}` };
    return null;
  }

  /** Apply the ops to what the caller edited from. Behind head (`baseVersion`) the ops
   *  are replayed on that base and three-way merged against head by block, so a
   *  concurrent save is reported instead of silently overwritten. Pure: reads only. */
  private candidateOf(name: string, head: VersionRecord, ops: PatchOp[], base: number | undefined): { ok: true; doc: KageDoc; merged: boolean } | { ok: false; code: string; msg: string; conflicts?: string[] } {
    try {
      if (base !== undefined && base !== head.v) {
        const baseRec = this.getVersion(name, base);
        if (!baseRec) return { ok: false, code: "not_found", msg: `base version v${base} not found` };
        const yours = applyPatch(baseRec.doc, ops);
        const merged = mergeThreeWay(baseRec.doc, head.doc, yours);
        if (!merged.ok) return { ok: false, code: "conflict", msg: `conflicting blocks: ${merged.conflicts.map((c) => c.blockId).join(", ")}`, conflicts: merged.conflicts.map((c) => c.blockId) };
        return { ok: true, doc: merged.doc!, merged: true };
      }
      return { ok: true, doc: applyPatch(head.doc, ops), merged: false };
    } catch (e) { return { ok: false, code: "invalid_patch", msg: (e as Error).message }; }
  }

  /** What `patch` WOULD do, with no side effects: no version, no quota tick, no audit
   *  entry, no event. Reading the Kage is enough (the verdict reveals nothing a reader
   *  could not compute), but `ok` answers "would the real patch succeed for this
   *  caller", so a reader gets ok:false with `forbidden` plus the rest of the picture. */
  checkPatch(name: string, ops: PatchOp[], author: Provenance, opts: { baseVersion?: number } = {}): CheckResult {
    const read = this.authorizeRead(name, author);
    if (!read.ok) return { ok: false, error: { code: read.code, msg: read.msg } };
    const now = this.clock();
    const key = `${this.workspaceName}\u0000${author.principal}`;
    const recent = (Store.dryRunTimes.get(key) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= MAX_DRY_RUNS_PER_HOUR) { Store.dryRunTimes.set(key, recent); return { ok: false, error: { code: "rate_limited", msg: `at most ${MAX_DRY_RUNS_PER_HOUR} dry runs per hour from one server` } }; }
    recent.push(now); Store.dryRunTimes.set(key, recent);

    const head = this.kages.get(name)!.versions.at(-1)!;
    const repo = Store.repoOfRef(head.ref);
    const { blockIds, structural } = touchedBy(ops, head.doc);
    let error: { code: string; msg: string; opIndex?: number; conflicts?: string[] } | undefined;
    const canWrite = this.allowed(author, repo, "write");
    if (!canWrite) error = { code: "forbidden", msg: `${author.principal} lacks write on ${repo}` };
    const claimed = canWrite ? this.claimBlock(name, blockIds, structural, author) : null;
    if (claimed) error = { code: "claimed", msg: claimed.msg };
    const claims = (structural ? ["root"] : []).concat(blockIds).filter((id) => !this.claims.canWrite(name, id, author.principal, now))
      .map((block) => ({ block, ...(canWrite ? { heldBy: this.claims.claimant(name, block, now) } : {}) }));

    const planned = this.candidateOf(name, head, ops, opts.baseVersion);
    if (!planned.ok) {
      const idx = /^op (\d+) /.exec(planned.msg);
      error ??= { code: planned.code, msg: planned.msg, ...(idx ? { opIndex: Number(idx[1]) } : {}), ...(planned.conflicts ? { conflicts: planned.conflicts } : {}) };
      return { ok: false, head: head.v, claims, error };
    }
    const doc = planned.doc;
    const validation = validate(doc);
    if (!error && !this.underQuota(author.principal)) error = { code: "rate_limited", msg: `${author.principal} exceeded ${this.quota} versions/hour` };
    if (!error && JSON.stringify(doc).includes("\\u0000")) error = { code: "invalid_content", msg: "documents may not contain the NUL character (U+0000)" };
    if (!error && !validation.ok) error = { code: "invalid_content", msg: `${validation.errors.length} validation errors` };
    return { ok: !error, head: head.v, ...(error ? {} : { wouldCreate: head.v + 1 }), merged: planned.merged, candidate: doc, previous: head.doc, validation, claims, ...(error ? { error } : {}) };
  }

  private writeVersion(repo: string, doc: KageDoc, author: Provenance, parent: string | null, change: VersionRecord["change"]): WriteResult {
    if (!this.allowed(author, repo, "write")) return err("forbidden", `${author.principal} lacks write on ${repo}`);
    if (!this.underQuota(author.principal)) return err("rate_limited", `${author.principal} exceeded ${this.quota} versions/hour`);

    // U+0000 cannot be stored by jsonb-backed persistence (Postgres rejects the
    // whole snapshot), and silently stripping it would break the signed digest.
    // Refuse it up front, for every backend alike, rather than lose a write later.
    if (JSON.stringify(doc).includes("\\u0000")) return err("invalid_content", "documents may not contain the NUL character (U+0000)");

    const v = validate(doc);
    if (!v.ok) return { ok: false, validation: v, error: { code: "invalid_content", msg: `${v.errors.length} validation errors` } };

    const kage = this.kages.get(doc.id) ?? { name: doc.id, versions: [] };
    if (doc.design !== undefined && (typeof doc.design !== "string" || doc.design.length > 40)) return err("invalid_content", "design is the id of a workspace design (a string of at most 40 characters)");
    // A new Kage starts in the workspace's default design unless it chose one. `design: ""` means "none, whatever
    // the default is"; it is dropped so a stored document never carries an empty field.
    if (doc.design === "") { const { design: _none, ...rest } = doc; doc = rest as KageDoc; }
    else if (doc.design === undefined && !kage.versions.length) { const d = this.defaultDesignId(); if (d) doc = { ...doc, design: d }; }
    // Pin the design as the version is made: later edits to the design reach this Kage only through a new version.
    // A design deleted since keeps the snapshot its previous version pinned, so editing such a Kage still works.
    let design: DesignSnapshot | undefined;
    if (doc.design) {
      const rec = this.designs.get(doc.design);
      const prior = kage.versions.length ? readSnapshot(kage.versions[kage.versions.length - 1].doc.resolved?.design) : undefined;
      if (rec) design = resolveDesign(rec.def);
      else if (prior && prior.id === doc.design) design = prior;
      else return err("not_found", `no design '${doc.design}' in this workspace`);
    }
    const vn = kage.versions.length + 1;
    // The Kage's uuid is minted once (first version) and carried forward, so the
    // share link is stable across edits and never reveals the name.
    const uuid = kage.versions[0]?.uuid ?? randomUUID();
    const ref = `kages://${this.workspace}/${repo}/${doc.id}@v${vn}`;
    const resolved = { system: systemOf(doc) + "@" + (systems[systemOf(doc)]?.version ?? ""), blocks: lockfile(doc), assets, ...(design ? { design } : {}) };
    // Deep clone at ingress: the stored, signed document must NOT share object
    // references with the caller's input, or a later mutation of that input
    // would silently change signed content whose digest no longer matches.
    const stored: KageDoc = clone({ ...doc, resolved });
    const dgst = digest(stored);
    const signature = signDigest(this.signerFor(author.principal), dgst);

    const record: VersionRecord = {
      ref, parent, name: doc.id, uuid, v: vn, digest: dgst, signature,
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

  // The repo and the delegated-permission intersection both come from the
  // resource + the full author, so a lifecycle change can't be done through a
  // repo the caller merely names, nor via an onBehalfOf the user can't authorize.
  private transition(name: string, to: LifecycleState, author: Provenance, needed: Grant): WriteResult {
    const head = this.head(name);
    if (!head) return err("not_found", `no kage '${name}'`);
    const repo = Store.repoOfRef(head.ref);
    if (!this.allowed(author, repo, needed)) return err("forbidden", `${author.principal} lacks ${needed} on ${repo}`);
    if (!LIFECYCLE_NEXT[head.state].includes(to)) return err("bad_state", `cannot go ${head.state} -> ${to}`);
    // One gate for every path into `published` (publish AND restore): a version
    // with validation errors can never become published, no back door.
    if (to === "published" && !head.validation.ok) return err("invalid_content", "cannot publish a version with validation errors");
    head.state = to;
    this.record(author.principal, to, head.ref);
    this.emit("kage.state.changed", head.ref, { to });
    return { ok: true, version: head };
  }

  /** Publish the head version: requires `publish` (intersected with onBehalfOf),
   *  and the version must be validation-clean. */
  publish(name: string, author: Provenance, visibility: Visibility = "private"): WriteResult {
    const head = this.head(name);
    if (!head) return err("not_found", `no kage '${name}'`);
    if (!head.validation.ok) return err("invalid_content", "cannot publish a version with validation errors");
    const r = this.transition(name, "published", author, "publish");
    if (r.ok && r.version) { r.version.visibility = visibility; this.emit("kage.published", r.version.ref); }
    return r;
  }

  /** Widen a published Kage's visibility. Needs `publish` on the resource — a
   *  draft can't be flipped public, and a principal without the grant can't
   *  change who sees it. */
  share(name: string, author: Provenance, visibility: Visibility): WriteResult {
    const head = this.head(name);
    if (!head) return err("not_found", `no kage '${name}'`);
    const repo = Store.repoOfRef(head.ref);
    if (!this.allowed(author, repo, "publish")) return err("forbidden", `${author.principal} lacks publish on ${repo}`);
    if (head.state !== "published") return err("bad_state", "only a published Kage can be shared");
    head.visibility = visibility;
    this.record(author.principal, "share:" + visibility, head.ref);
    this.emit("kage.state.changed", head.ref, { visibility });
    return { ok: true, version: head };
  }

  submitForReview(name: string, author: Provenance): WriteResult { return this.transition(name, "review", author, "write"); }
  deprecate(name: string, author: Provenance): WriteResult { return this.transition(name, "deprecated", author, "write"); }

  /** Put a Kage away — reversible and soft. A draft may be archived by a writer,
   *  but archiving a PUBLISHED Kage takes content others may depend on offline, so
   *  that needs `publish`. Visibility is reset to private so a later restore can't
   *  silently re-expose what was once public — the restorer re-shares explicitly. */
  archive(name: string, author: Provenance): WriteResult {
    const head = this.head(name);
    if (!head) return err("not_found", `no kage '${name}'`);
    const needed: Grant = head.state === "published" ? "publish" : "write";
    const r = this.transition(name, "archived", author, needed);
    if (r.ok && r.version) r.version.visibility = "private";
    return r;
  }

  /** Pull a published Kage back to draft — the missing inverse of publish. Resets
   *  visibility so re-publishing is an explicit, deliberate choice again. */
  unpublish(name: string, author: Provenance): WriteResult {
    const r = this.transition(name, "draft", author, "publish");
    if (r.ok && r.version) r.version.visibility = "private";
    return r;
  }

  /** Bring an archived (or deprecated) Kage back to published — private until the
   *  owner shares it again, so restore never re-leaks a formerly-public Kage. */
  restore(name: string, author: Provenance): WriteResult { return this.transition(name, "published", author, "publish"); }

  /** Permanently remove a Kage from the workspace. Requires `admin` — the highest
   *  bar, because unlike archiving this is irreversible: the signed version chain
   *  is dropped. An audit entry still records WHO removed WHAT and WHEN, so the
   *  deletion itself stays accountable even though the document is gone. Returns
   *  the removed head so the caller can purge its public share by uuid. */
  remove(name: string, author: Provenance): WriteResult {
    const head = this.head(name);
    if (!head) return err("not_found", `no kage '${name}'`);
    const repo = Store.repoOfRef(head.ref);
    if (!this.allowed(author, repo, "admin")) return err("forbidden", `${author.principal} lacks admin on ${repo}`);
    this.kages.delete(name);
    // Drop everything else keyed by this name, so a later Kage reusing it can't
    // inherit a stale lease or someone else's old comments. (public_shares is
    // purged by the server layer via the returned uuid — it lives in Supabase.)
    this.claims.releaseAll(name);
    this.comments.purge(name);
    this.memberships.delete(name); // a later Kage reusing this name must not inherit stale project tags
    this.record(author.principal, "delete", head.ref);
    this.emit("kage.deleted", head.ref, { uuid: head.uuid });
    return { ok: true, version: head };
  }

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
    return { ref: r.ref, title: r.doc.title, system: systemOf(r.doc), blocks: Object.keys(r.doc.blocks).length, lastAuthor: r.author.principal, state: r.state, projects: this.projectsOf(name) };
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

  /** A lease is a write capability: only writers may reserve blocks, using the store clock. */
  claimBlocks(kage: string, blocks: string[], author: Provenance, ttl = 300): CommentResult<{ claimed: true }> {
    const head = this.head(kage);
    if (!head) return cerr("not_found", `no kage '${kage}'`);
    if (!this.allowed(author, Store.repoOfRef(head.ref), "write")) return cerr("forbidden", "write access required to claim blocks");
    if (!Array.isArray(blocks) || !blocks.length || blocks.length > 100 || blocks.some(b => typeof b !== "string" || !b.length || b.length > 120) || !Number.isFinite(ttl) || ttl < 1 || ttl > 3600) return cerr("invalid_params", "claims need 1 to 100 block patterns and a TTL of 1 to 3600 seconds");
    const result = this.claims.claim(kage, blocks, author.principal, ttl, this.clock());
    return result.ok ? { ok: true, value: { claimed: true } } : cerr("claimed", `already claimed by ${result.heldBy}`);
  }

  // --- collaboration surface ----------------------------------------------

  /** The unchecked, single-note form kept for internal callers and tests. Use
   *  `addComment` for anything that crosses a trust boundary. */
  comment(kage: string, block: string, author: string, text: string, suggestedPatch?: PatchOp[]): Comment {
    const c = this.comments.add({ kage, block, author, text, suggestedPatch }, new Date(this.clock()).toISOString());
    this.emit("kage.comment.created", kage, { block, commentId: c.id });
    return c;
  }

  // --- discussion: threaded, pinned, voted comments, all permission-checked ----

  private commentTimes = new Map<string, number[]>();
  /** Edits, deletes, votes and resolves per principal. Separate from commentTimes so voting cannot use up the budget for adding. */
  private discussionTimes = new Map<string, number[]>();

  /** Every discussion write is a full-workspace CAS commit, so a loop of votes or edits is as costly as a loop of comments. Records the attempt when it is allowed. */
  private throttleDiscussion(author: Provenance): { ok: false; error: { code: string; msg: string } } | null {
    const now = this.clock(), recent = (this.discussionTimes.get(author.principal) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= MAX_DISCUSSION_WRITES_PER_HOUR) return cerr("rate_limited", `at most ${MAX_DISCUSSION_WRITES_PER_HOUR} edits, votes, resolves and deletes per hour`);
    this.discussionTimes.set(author.principal, [...recent, now]);
    return null;
  }
  private guestWrite = false;

  /** Callers must be a real principal: reading a public Kage is open to anyone,
   *  but writing into its discussion is not. */
  private commenter(author: Provenance): CommentResult<null> {
    // A guest (feedback from a shared link) may add one root comment and do nothing else, so every
    // other discussion operation, and every permission the view advertises, treats it as not real.
    if (author.principal.startsWith("guest:") && !this.guestWrite) return cerr("forbidden", "guests can only leave feedback on the shared page");
    if (!author.principal || author.principal === "anon" || author.principal.startsWith("anon:")) return cerr("forbidden", "sign in to take part in the discussion");
    return { ok: true, value: null };
  }

  /** What a given viewer may do to each comment, decided here so the UI never
   *  has to guess (and can never offer a button the server would refuse). */
  private commentView(c: Comment, author: Provenance, repo: string): CommentView {
    const { votes, ...rest } = c;
    const mine = votes?.[author.principal] ?? 0;
    const real = !!this.commenter(author).ok;
    const own = real && c.author === author.principal;
    const isRoot = !c.parent;
    return {
      ...rest,
      score: Object.values(votes ?? {}).reduce<number>((a, b) => a + b, 0),
      myVote: mine,
      canEdit: own && !c.deleted,
      canDelete: !c.deleted && real && (own || this.allowed(author, repo, "admin")),
      canResolve: isRoot && !c.deleted && real && (own || this.allowed(author, repo, "write")),
      canVote: real && !c.deleted && !own,
    };
  }

  addComment(kage: string, author: Provenance, input: { block?: string; text: string; parent?: string; pos?: { x: number; y: number }; suggestedPatch?: PatchOp[] }): CommentResult<CommentView> {
    // Existence first, then identity: asking "who are you" before "does it exist" lets an anonymous caller tell a missing Kage from a private one.
    const read = this.authorizeRead(kage, author); if (!read.ok) return cerr(read.code, read.msg);
    const who = this.commenter(author); if (!who.ok) return who;
    const text = typeof input.text === "string" ? input.text.replace(/\r\n/g, "\n").trim() : "";
    if (!text) return cerr("invalid_comment", "a comment needs some text");
    if (text.length > MAX_COMMENT_CHARS) return cerr("invalid_comment", `comments are limited to ${MAX_COMMENT_CHARS} characters`);
    if (text.includes("\u0000")) return cerr("invalid_comment", "comments may not contain the NUL character");
    if (this.comments.all(kage).length >= MAX_COMMENTS_PER_KAGE) return cerr("rate_limited", `this Kage already has ${MAX_COMMENTS_PER_KAGE} comments`);
    const now = this.clock(), recent = (this.commentTimes.get(author.principal) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= MAX_COMMENTS_PER_HOUR) return cerr("rate_limited", `at most ${MAX_COMMENTS_PER_HOUR} comments per hour`);

    let block = typeof input.block === "string" ? input.block : "", parent: Comment | undefined;
    if (input.parent) {
      parent = this.comments.get(input.parent);
      if (!parent || parent.kage !== kage) return cerr("not_found", "the comment you are replying to does not exist");
      if (parent.deleted) return cerr("invalid_comment", "that comment was deleted");
      if (this.comments.depth(parent.id) >= MAX_COMMENT_DEPTH) return cerr("invalid_comment", "this thread is nested too deeply; reply higher up");
      block = parent.block; // a reply is about the same thing its parent is about
    } else if (block && !Object.hasOwn(read.record.doc.blocks, block)) return cerr("unknown_block", `no block '${block}' in ${kage}`);

    let pos: { x: number; y: number } | undefined;
    if (input.pos !== undefined && !parent) {
      const x = Number(input.pos?.x), y = Number(input.pos?.y);
      if (!block || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return cerr("invalid_comment", "a pin needs a block and x/y between 0 and 1");
      pos = { x: Math.round(x * 1e4) / 1e4, y: Math.round(y * 1e4) / 1e4 };
    }
    if (input.suggestedPatch !== undefined) {
      // The patch lands in the one snapshot row every write rewrites, so its size is bounded like the text
      // is, and a NUL would make Postgres reject the whole commit (a 503 the user cannot explain).
      if (!Array.isArray(input.suggestedPatch) || input.suggestedPatch.length > 50) return cerr("invalid_comment", "a suggested patch is a list of at most 50 operations");
      const bad = checkPatchOps(input.suggestedPatch); if (bad) return cerr("invalid_comment", `suggested patch: ${bad}`);
      const json = JSON.stringify(input.suggestedPatch);
      if (json.length > MAX_PATCH_CHARS) return cerr("invalid_comment", `a suggested patch is limited to ${MAX_PATCH_CHARS} characters`);
      if (json.includes("\\u0000")) return cerr("invalid_comment", "a suggested patch may not contain the NUL character");
    }

    const c = this.comments.add({ kage, block, author: author.principal, text, version: read.record.v, ...(parent ? { parent: parent.id } : {}), ...(pos ? { pos } : {}), ...(input.suggestedPatch ? { suggestedPatch: input.suggestedPatch } : {}) }, new Date(now).toISOString());
    this.commentTimes.set(author.principal, [...recent, now]);
    this.emit("kage.comment.created", read.record.ref, { block, commentId: c.id, ...(parent ? { parent: parent.id } : {}) });
    return { ok: true, value: this.commentView(c, author, Store.repoOfRef(read.record.ref)) };
  }

  /** Feedback from someone who opened a shared link and has no account. It is allowed only on a Kage
   *  whose head is published with link/public visibility (what an anonymous reader can already open),
   *  adds nothing but a root comment, and is attributed to `guest:<name>`: the name is whatever the
   *  visitor typed, so it identifies nobody and grants nothing. Guests have their own, smaller quota
   *  so a link in the wild cannot fill a Kage's discussion. */
  addGuestComment(uuid: string, input: { name: string; text: string; block?: string; pos?: { x: number; y: number } }): CommentResult<{ id: string; kage: string }> {
    const kage = this.nameByUuid(uuid);
    if (!kage) return cerr("not_found", "no such shared Kage");
    const open = this.authorizeRead(kage, { principal: "anon" });
    if (!open.ok) return cerr("forbidden", "this Kage is not open for feedback");
    const who = typeof input.name === "string" ? input.name.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) : "";
    if (!who) return cerr("invalid_comment", "say who you are so the author knows who to thank");
    if (this.comments.all(kage).filter((c) => c.author.startsWith("guest:")).length >= MAX_GUEST_COMMENTS_PER_KAGE) return cerr("rate_limited", "this page has reached its limit of guest feedback; ask the author to open it up");
    this.guestWrite = true;
    let r: CommentResult<CommentView>;
    try { r = this.addComment(kage, { principal: `guest:${who}` }, { text: input.text, ...(input.block ? { block: input.block } : {}), ...(input.pos ? { pos: input.pos } : {}) }); } finally { this.guestWrite = false; }
    return r.ok ? { ok: true, value: { id: r.value.id, kage } } : r;
  }

  listComments(kage: string, author: Provenance): CommentResult<CommentView[]> {
    const read = this.authorizeRead(kage, author); if (!read.ok) return cerr(read.code, read.msg);
    const repo = Store.repoOfRef(read.record.ref);
    return { ok: true, value: this.comments.all(kage).map((c) => this.commentView(c, author, repo)) };
  }

  /** Find a comment the caller is allowed to see, with the repo for permission checks. */
  private commentFor(id: string, author: Provenance): CommentResult<{ comment: Comment; repo: string; ref: string }> {
    const c = this.comments.get(id); if (!c) return cerr("not_found", "no such comment");
    const read = this.authorizeRead(c.kage, author); if (!read.ok) return cerr(read.code, read.msg);
    return { ok: true, value: { comment: c, repo: Store.repoOfRef(read.record.ref), ref: read.record.ref } };
  }

  editComment(id: string, author: Provenance, text: string): CommentResult<CommentView> {
    const who = this.commenter(author); if (!who.ok) return who;
    const slow = this.throttleDiscussion(author); if (slow) return slow;
    const f = this.commentFor(id, author); if (!f.ok) return f;
    const { comment, repo } = f.value;
    if (comment.deleted) return cerr("invalid_comment", "that comment was deleted");
    if (comment.author !== author.principal) return cerr("forbidden", "you can only edit your own comments");
    const t = typeof text === "string" ? text.replace(/\r\n/g, "\n").trim() : "";
    if (!t || t.length > MAX_COMMENT_CHARS || t.includes("\u0000")) return cerr("invalid_comment", `a comment needs 1–${MAX_COMMENT_CHARS} characters`);
    this.comments.edit(id, t, new Date(this.clock()).toISOString());
    return { ok: true, value: this.commentView(this.comments.get(id)!, author, repo) };
  }

  deleteComment(id: string, author: Provenance): CommentResult<{ id: string; tombstone: boolean }> {
    const who = this.commenter(author); if (!who.ok) return who;
    const slow = this.throttleDiscussion(author); if (slow) return slow;
    const f = this.commentFor(id, author); if (!f.ok) return f;
    const { comment, repo, ref } = f.value;
    if (comment.author !== author.principal && !this.allowed(author, repo, "admin")) return cerr("forbidden", "only the author or an admin can delete a comment");
    const tombstone = this.comments.children(id).length > 0;
    this.comments.remove(id);
    this.emit("kage.comment.deleted", ref, { commentId: id });
    return { ok: true, value: { id, tombstone } };
  }

  /** Resolve (or reopen) a whole thread: only a root comment carries the flag. */
  resolveComment(id: string, author: Provenance, resolved = true): CommentResult<CommentView> {
    const who = this.commenter(author); if (!who.ok) return who;
    const slow = this.throttleDiscussion(author); if (slow) return slow;
    const f = this.commentFor(id, author); if (!f.ok) return f;
    const { comment, repo, ref } = f.value;
    if (comment.parent) return cerr("invalid_comment", "resolve the thread's first comment, not a reply");
    if (comment.author !== author.principal && !this.allowed(author, repo, "write")) return cerr("forbidden", "only the author or someone who can edit this Kage can resolve a thread");
    this.comments.resolve(id, author.principal, resolved, new Date(this.clock()).toISOString());
    this.emit("kage.comment.resolved", ref, { commentId: id, resolved });
    return { ok: true, value: this.commentView(this.comments.get(id)!, author, repo) };
  }

  voteComment(id: string, author: Provenance, value: number): CommentResult<CommentView> {
    const who = this.commenter(author); if (!who.ok) return who;
    const slow = this.throttleDiscussion(author); if (slow) return slow;
    const f = this.commentFor(id, author); if (!f.ok) return f;
    const { comment, repo } = f.value;
    if (value !== 1 && value !== -1 && value !== 0) return cerr("invalid_comment", "a vote is 1, -1 or 0");
    if (comment.deleted) return cerr("invalid_comment", "that comment was deleted");
    if (comment.author === author.principal) return cerr("invalid_comment", "you cannot vote on your own comment");
    this.comments.vote(id, author.principal, value);
    return { ok: true, value: this.commentView(this.comments.get(id)!, author, repo) };
  }
}

const MAX_COMMENT_CHARS = 4000, MAX_PATCH_CHARS = 16_000, MAX_COMMENT_DEPTH = 8, MAX_COMMENTS_PER_KAGE = 2000, MAX_COMMENTS_PER_HOUR = 60, MAX_DISCUSSION_WRITES_PER_HOUR = 200, MAX_GUEST_COMMENTS_PER_KAGE = 50;

/** A comment as one viewer sees it: scores and what they may do, never the raw votes. */
export type CommentView = Omit<Comment, "votes"> & { score: number; myVote: number; canEdit: boolean; canDelete: boolean; canResolve: boolean; canVote: boolean };
export type CommentResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; msg: string } };
export const MAX_DRY_RUNS_PER_HOUR = 300;

export type CheckResult =
  | { ok: false; head?: number; claims?: { block: string; heldBy?: string | null }[]; error: { code: string; msg: string; opIndex?: number; conflicts?: string[] } }
  | { ok: boolean; head: number; wouldCreate?: number; merged: boolean; candidate: KageDoc; previous: KageDoc; validation: ValidateResult; claims: { block: string; heldBy?: string | null }[]; error?: { code: string; msg: string } };

export type BriefResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; msg: string; current?: WorkspaceBriefRecord | null } };
function berr(code: string, msg: string, current?: WorkspaceBriefRecord | null): { ok: false; error: { code: string; msg: string; current?: WorkspaceBriefRecord | null } } { return { ok: false, error: { code, msg, ...(current !== undefined ? { current } : {}) } }; }
function cerr(code: string, msg: string): { ok: false; error: { code: string; msg: string } } { return { ok: false, error: { code, msg } }; }

function err(code: string, msg: string): WriteResult { return { ok: false, error: { code, msg } }; }

/** What an op list touches: the specific block ids, and whether it is a
 *  STRUCTURAL edit (the doc root, state/system/data/compositions, or a wholesale `/blocks`
 *  rewrite). A `/blocks` replace touches every current block, so it must clear
 *  every block's claim — not slip past because it names no single id. */
function touchedBy(ops: PatchOp[], headDoc: KageDoc): { blockIds: string[]; structural: boolean } {
  const ids = new Set<string>();
  let structural = false;
  const mark = (path: string | undefined) => {
    if (!path) return;
    const m = /^\/blocks\/([a-zA-Z0-9_-]+)/.exec(path);
    if (m) { ids.add(m[1]); return; }
    if (path === "/blocks") { for (const id of Object.keys(headDoc.blocks ?? {})) ids.add(id); structural = true; return; }
    if (path === "" || path === "/" || /^\/(root|state|system|data|sources|persist|compositions)(\/|$)/.test(path)) structural = true;
  };
  for (const op of ops) { mark(op.path); if (op.op === "move") mark(op.from); }
  return { blockIds: [...ids], structural };
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
  // Definition blocks are signed content too; leaving them unpinned would let
  // a registry upgrade change a historical composition's implementation.
  for (const [name, def] of Object.entries(doc.compositions || {})) {
    for (const [id, block] of Object.entries(def.blocks)) {
      const r = resolve(sysId, block.type);
      if (r.ref) out[`compositions/${name}/${id}`] = r.ref;
    }
  }
  return out;
}
