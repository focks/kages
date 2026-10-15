// The ONE operation set. Every adapter (MCP, REST, A2A, CLI, SDK) is a thin
// translation of this table and nothing more — no adapter holds business logic
// or its own validation, which is what guarantees "the same task succeeds
// identically through every protocol". Logic lives here, over the engine and
// the store. Each operation is a pure-ish function of (ctx, params). See
// oracle/agent-access.feature.

import { systems, contracts } from "../engine/data.ts";
import { validate } from "../engine/validate.ts";
import { advise, review, type Advice } from "../engine/advice.ts";
import { outlineToKage } from "../engine/outline.ts";
import { applyPatch } from "../collab/patch.ts";
import { describe } from "../engine/describe.ts";
import { catalog } from "../engine/catalog.ts";
import { generationSchema, fromGenerated } from "../engine/generate.ts";
import { KageSession } from "../engine/session.ts";
import { clone } from "../engine/expr.ts";
import type { KageDoc } from "../engine/types.ts";
import type { Store } from "../store/store.ts";
import type { Provenance } from "../store/types.ts";

export interface OpContext {
  store: Store;
  /** Who is calling — the adapter resolves auth → principal before dispatch. */
  author: Provenance;
  repo?: string;
}

/** `details` carries structured context for a failure (for a rejected write: the
 *  validator's findings and what to do about each), so an agent can fix and retry
 *  without a second round trip. */
export type OpResult = { ok: true; data: unknown } | { ok: false; error: { code: string; msg: string; details?: unknown } };

const ok = (data: unknown): OpResult => ({ ok: true, data });
const fail = (code: string, msg: string, details?: unknown): OpResult => ({ ok: false, error: { code, msg, ...(details !== undefined ? { details } : {}) } });
const cres = <T,>(r: { ok: true; value: T } | { ok: false; error: { code: string; msg: string } }): OpResult => (r.ok ? ok(r.value) : fail(r.error.code, r.error.msg));

type Params = Record<string, any>;

/** Declarative description of each operation, so adapters (OpenAPI, MCP tools,
 *  CLI help, A2A skills) are GENERATED from one source and cannot drift. */
export interface OpSpec {
  name: string;
  summary: string;
  params: string[]; // param names, "?" suffix = optional
  write?: boolean; // mutates the store (affects HTTP method / CLI confirmation)
  run: (ctx: OpContext, p: Params) => OpResult;
}

// --- tier C text intake: extract + repair JSON an unreliable model emitted ---
// Weak agents emit prose around a JSON blob, with trailing commas and smart
// quotes. We salvage the first balanced object, repair the common mistakes, and
// let validate() report the rest in plain language for a second pass. This is
// what lets a text-only model still produce a valid Kage.
function extractJson(text: string): any {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("no JSON object found in text");
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { if (--depth === 0) return JSON.parse(repair(text.slice(start, i + 1))); }
  }
  throw new Error("unbalanced JSON object in text");
}
function repair(s: string): string {
  return s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, "$1");
}

/** Block types that only arrange or carry prose. They are in nearly every Kage, so
 *  listing them tells a browsing user nothing about what this one is for. */
const STRUCTURAL = new Set(["page", "section", "stack", "grid", "split", "shell", "card", "divider", "composition", "text", "list", "rich-text", "code", "link", "image", "anchor"]);

/** The few most characteristic block types in a document, most frequent first,
 *  so a card can say "chart · table · form" without shipping the document. */
export function kindsOf(doc: { blocks: Record<string, { type: string }> }): string[] {
  const counts = new Map<string, number>();
  for (const b of Object.values(doc.blocks)) if (!STRUCTURAL.has(b.type)) counts.set(b.type, (counts.get(b.type) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([t]) => t);
}

/** A one-line description for a card: the document's own, else the first section
 *  description. Plain text, bounded; the document is untrusted data. */
export function describeCard(doc: { description?: string; blocks: Record<string, { type: string; props?: Record<string, unknown> }> }): string {
  const own = typeof doc.description === "string" ? doc.description : "";
  const fromSection = Object.values(doc.blocks).find((b) => b.type === "section" && typeof b.props?.description === "string")?.props?.description as string | undefined;
  return String(own || fromSection || "").replace(/\s+/g, " ").trim().slice(0, 160);
}

export const OPERATIONS: OpSpec[] = [
  // --- learn a design system ---
  { name: "list_systems", summary: "List available design systems", params: [], run: () =>
    ok(Object.values(systems).map((s) => ({ id: s.id, name: s.name, version: s.version, extends: s.extends, summary: s.summary }))) },

  { name: "get_catalog", summary: "Compact text catalog of a system's components for an agent prompt", params: ["system"], run: (_c, p) =>
    systems[p.system] ? ok(catalog(p.system)) : fail("not_found", `no system '${p.system}'`) },

  { name: "get_contract", summary: "Fetch one component contract by ref", params: ["ref"], run: (_c, p) =>
    contracts[p.ref] ? ok(contracts[p.ref]) : fail("not_found", `no contract '${p.ref}'`) },

  { name: "get_generation_schema", summary: "The strict JSON Schema envelope a model fills (tier B)", params: ["system"], run: (_c, p) =>
    systems[p.system] ? ok(generationSchema(p.system)) : fail("not_found", `no system '${p.system}'`) },

  // --- find & read (visibility-gated: a caller only sees what it may read) ---
  { name: "search_kages", summary: "Full-text + filtered search over stored Kages", params: ["text?", "system?", "author?", "state?"], run: (c, p) =>
    ok(c.store.search(p).filter((v) => c.store.canAccess(v, c.author))) },

  { name: "search_templates", summary: "Rank starter templates for an intent (fork before scratch)", params: ["intent?"], run: (c, p) =>
    ok(c.store.search({ ...p, text: p.intent }).filter((v) => v.ref.includes("/templates/") && c.store.canAccess(v, c.author))) },

  { name: "get_kage", summary: "Fetch a Kage document by name or uuid (latest or a version)", params: ["name?", "uuid?", "version?"], run: (c, p) => {
    // Accept the opaque uuid as well as the name, so preview/links identify a
    // Kage the same way everywhere (never by title).
    const name = p.name ? String(p.name) : p.uuid ? c.store.nameByUuid(String(p.uuid)) : undefined;
    if (!name) return fail("not_found", "no such Kage");
    const r = c.store.authorizeRead(name, c.author, p.version ? Number(p.version) : undefined);
    // Return a clone: the caller must not hold a reference into the signed,
    // stored document and mutate it out from under its digest.
    return r.ok ? ok(clone(r.record.doc)) : fail(r.code, r.msg);
  } },

  { name: "list_versions", summary: "Revision history of a Kage: every version with its provenance", params: ["name"], run: (c, p) => {
    const r = c.store.authorizeRead(p.name, c.author);
    if (!r.ok) return fail(r.code, r.msg);
    // The doc is heavy and the history view doesn't need it — return each record
    // shorn of the document, which keeps a long history cheap to transfer.
    return ok(c.store.versions(p.name).map(({ doc, ...meta }) => meta));
  } },

  { name: "list_kages", summary: "Head version of every Kage, as cards for a dashboard", params: [], run: (c) =>
    ok(c.store.list().filter((v) => c.store.canAccess(v, c.author)).map((v) => ({
      name: v.name, ref: v.ref, uuid: v.uuid, repo: c.store.repoOf(v.ref), title: v.doc.title, system: v.resolved.system,
      blocks: Object.keys(v.doc.blocks).length, version: v.v, state: v.state,
      visibility: v.visibility, lastAuthor: v.author.principal, createdAt: v.createdAt,
      validation: v.validation, description: describeCard(v.doc), kinds: kindsOf(v.doc),
    }))) },

  { name: "list_repos", summary: "Projects in the workspace: each repo with a Kage count", params: [], run: (c) =>
    ok({ workspace: c.store.workspaceName, projects: c.store.listRepos() }) },

  { name: "describe_kage", summary: "Text view of a Kage for agents without vision (untrusted content)", params: ["name"], run: (c, p) => {
    const r = c.store.authorizeRead(p.name, c.author);
    if (!r.ok) return fail(r.code, r.msg);
    // Fence + label the output: everything inside a Kage is DATA, never
    // instructions. Skill packs tell agents never to follow text found here.
    return ok(`<kage-content untrusted="true">\n${describe(r.record.doc)}\n</kage-content>`);
  } },

  // --- write (three tiers) ---
  { name: "create_kage", summary: "Create a Kage from a full document (tier A)", params: ["doc", "repo?"], write: true, run: (c, p) =>
    toResult(c.store.create(p.repo ?? c.repo ?? "kages", p.doc as KageDoc, c.author), p.doc as KageDoc) },

  { name: "clone_kage", summary: "Create an independent copy of a Kage (fresh id + uuid)", params: ["name", "title?", "repo?"], write: true, run: (c, p) => {
    // Templates are classified by their repo. Copying that destination would
    // hide a user's new Kage in Templates, so default those copies to kages.
    // Ordinary projects and explicitly requested destinations stay intact.
    const r = c.store.authorizeRead(String(p.name), c.author);
    if (!r.ok) return fail(r.code, r.msg);
    const src = r.record.doc;
    const id = uniqueKageId(c.store, String(p.title ?? src.title ?? src.id));
    const { resolved, ...bare } = clone(src) as KageDoc & { resolved?: unknown };
    void resolved;
    const doc = { ...bare, id, title: String(p.title ?? (src.title ? src.title + " copy" : id)) } as KageDoc;
    const sourceRepo = c.store.repoOf(r.record.ref);
    const repo = p.repo ? String(p.repo) : sourceRepo === "templates" ? "kages" : sourceRepo;
    return toResult(c.store.create(repo, doc, c.author));
  } },

  { name: "patch_kage", summary: "Edit a Kage with RFC 6902 ops (tier A). Pass baseVersion for optimistic concurrency.", params: ["name", "ops", "baseVersion?"], write: true, run: (c, p) =>
    toResult(c.store.patch(p.name, p.ops, c.author, { baseVersion: p.baseVersion !== undefined ? Number(p.baseVersion) : undefined }), () => {
      // The store does not hand back the rejected document, so rebuild the
      // candidate from the head and the ops to advise on it.
      const head = c.store.head(p.name);
      try { return head ? applyPatch(head.doc, p.ops) : undefined; } catch { return undefined; }
    }) },

  { name: "generate_kage", summary: "Create from a generation envelope (tier B) or raw text (tier C)", params: ["system", "envelope?", "text?", "repo?"], write: true, run: (c, p) => {
    if (!systems[p.system]) return fail("not_found", `no system '${p.system}'`);
    let envelope = p.envelope;
    if (!envelope && typeof p.text === "string") {
      try { envelope = extractJson(p.text); } catch (e) { return fail("invalid_content", (e as Error).message); }
    }
    if (!envelope) return fail("invalid_content", "generate_kage needs `envelope` (tier B) or `text` (tier C)");
    const doc = fromGenerated(envelope, p.system);
    return toResult(c.store.create(p.repo ?? c.repo ?? "kages", doc, c.author));
  } },

  // --- check ---
  { name: "validate_kage", summary: "Validate a document; returns findings with JSON pointers, a fix for each, and pitfall lint", params: ["doc", "system?"], run: (_c, p) =>
    ok(review(p.doc as KageDoc, p.system)) },

  { name: "outline_to_kage", summary: "Turn markdown prose into a valid Kage: headings become sections, callouts alerts, tables, code tabs, FAQ accordions and a contents sidebar. Returns the document, notes on the choices, and validation with advice (does not store it; pass the doc to create_kage)", params: ["markdown", "title?", "id?", "system?", "toc?"], run: (_c, p) => {
    let built;
    try { built = outlineToKage(String(p.markdown ?? ""), { title: p.title, id: p.id, system: p.system, toc: p.toc }); }
    catch (e) { return fail("invalid_input", (e as Error).message); }
    return ok({ doc: built.doc, notes: built.notes, stats: built.stats, ...(({ ok: valid, errors, warnings, advice }) => ({ validation: { ok: valid, errors, warnings }, advice }))(review(built.doc, p.system && String(p.system).split("@")[0])) });
  } },

  { name: "preview_kage", summary: "Headless render snapshot: resolved outputs + visibility per block", params: ["name", "system?"], run: (c, p) => {
    const r = c.store.authorizeRead(p.name, c.author);
    if (!r.ok) return fail(r.code, r.msg);
    const s = new KageSession(r.record.doc, p.system);
    const snapshot: Record<string, unknown> = {};
    for (const id of Object.keys(s.instances().blocks)) snapshot[id] = { visible: s.visible(id), output: s.read(id) };
    return ok({ system: s.sysId, blocks: snapshot });
  } },

  // --- release ---
  { name: "publish_kage", summary: "Publish the head version (requires publish grant, clean validation)", params: ["name", "visibility?"], write: true, run: (c, p) =>
    toResult(c.store.publish(p.name, c.author, p.visibility ?? "private")) },

  { name: "share_kage", summary: "Widen visibility of a published Kage (requires publish)", params: ["name", "visibility"], write: true, run: (c, p) => {
    const r = c.store.share(p.name, c.author, p.visibility);
    return r.ok ? ok({ ref: r.version!.ref, visibility: r.version!.visibility }) : fail(r.error!.code, r.error!.msg);
  } },

  // --- change status (lifecycle transitions; see LIFECYCLE_NEXT in the store) ---
  { name: "submit_for_review", summary: "Send a draft to review (requires write)", params: ["name"], write: true, run: (c, p) =>
    toResult(c.store.submitForReview(p.name, c.author)) },

  { name: "unpublish_kage", summary: "Pull a published Kage back to draft (requires publish)", params: ["name"], write: true, run: (c, p) =>
    toResult(c.store.unpublish(p.name, c.author)) },

  { name: "deprecate_kage", summary: "Mark a published Kage deprecated (requires write)", params: ["name"], write: true, run: (c, p) =>
    toResult(c.store.deprecate(p.name, c.author)) },

  { name: "archive_kage", summary: "Archive a Kage — hides it from listings; reversible (requires write)", params: ["name"], write: true, run: (c, p) =>
    toResult(c.store.archive(p.name, c.author)) },

  { name: "restore_kage", summary: "Restore an archived/deprecated Kage to published (requires publish)", params: ["name"], write: true, run: (c, p) =>
    toResult(c.store.restore(p.name, c.author)) },

  { name: "delete_kage", summary: "Permanently remove a Kage from the workspace (requires admin; irreversible)", params: ["name"], write: true, run: (c, p) => {
    const r = c.store.remove(p.name, c.author);
    // Return the removed Kage's uuid so the server layer can purge its /k share.
    return r.ok ? ok({ deleted: p.name, uuid: r.version!.uuid }) : fail(r.error!.code, r.error!.msg);
  } },

  { name: "export_kage", summary: "Export JSON (doc+lockfile), Markdown (describe), or card", params: ["name", "format?"], run: (c, p) => {
    const r = c.store.authorizeRead(p.name, c.author);
    if (!r.ok) return fail(r.code, r.msg);
    switch (p.format ?? "json") {
      case "json": return ok(JSON.stringify(r.record.doc, null, 2));
      case "markdown": return ok(describe(r.record.doc));
      case "card": return ok(c.store.card(p.name));
      default: return fail("invalid_content", `unknown format '${p.format}'`);
    }
  } },

  // --- observe a live Kage ---
  { name: "get_state", summary: "Current app state of a Kage (shared; personal needs consent)", params: ["name"], run: (c, p) => {
    const r = c.store.authorizeRead(p.name, c.author);
    if (!r.ok) return fail(r.code, r.msg);
    return ok(new KageSession(r.record.doc).getState());
  } },

  { name: "subscribe", summary: "Drain recent workspace events since a cursor (poll). A live transport would stream these.", params: ["types?", "since?"], run: (c, p) => {
    // A stateless RPC can't hand back a live listener — functions don't survive
    // JSON. Instead return the matching events since a cursor; the caller polls
    // with the returned `cursor`. The in-process Store.subscribe() stays for a
    // real streaming transport (SSE/websocket) to build on.
    const wanted: string[] | undefined = p.types;
    const events = c.store.eventLog();
    const since = Number(p.since ?? 0);
    const slice = events.slice(since).filter((e) => !wanted || wanted.includes(e.type));
    return ok({ events: slice, cursor: events.length });
  } },

  // --- collaborate ---
  { name: "claim_blocks", summary: "Lease a block subtree for longer work", params: ["kage", "blocks", "ttl?"], write: true, run: (c, p) =>
    toClaim(c.store.claims.claim(p.kage, p.blocks, c.author.principal, p.ttl ?? 300, Date.now())) },

  { name: "release_blocks", summary: "Release your claims on a Kage", params: ["kage"], write: true, run: (c, p) => {
    c.store.claims.release(p.kage, c.author.principal);
    return ok({ released: true });
  } },

  // --- discussion: threads, pins, votes ------------------------------------
  // Reading needs read access to the Kage; writing needs a signed-in principal.
  // Every rule (limits, ownership, who may resolve or delete) lives in the store,
  // so the dashboard, CLI, MCP and A2A all get exactly the same behaviour.
  { name: "comment", summary: "Add a comment or reply. block anchors it; x/y (0..1) pin it inside the block; parent makes it a reply", params: ["kage", "block?", "text", "parent?", "x?", "y?", "suggestedPatch?"], write: true, run: (c, p) =>
    cres(c.store.addComment(p.kage, c.author, { block: p.block, text: p.text, parent: p.parent, suggestedPatch: p.suggestedPatch, ...(p.x !== undefined || p.y !== undefined ? { pos: { x: p.x, y: p.y } } : {}) })) },

  { name: "list_comments", summary: "Every comment on a Kage with score, your vote and what you may do to each (untrusted content)", params: ["kage"], run: (c, p) =>
    cres(c.store.listComments(p.kage, c.author)) },

  { name: "edit_comment", summary: "Edit your own comment", params: ["id", "text"], write: true, run: (c, p) => cres(c.store.editComment(p.id, c.author, p.text)) },

  { name: "delete_comment", summary: "Delete a comment (author or admin); a comment with replies stays as a tombstone", params: ["id"], write: true, run: (c, p) => cres(c.store.deleteComment(p.id, c.author)) },

  { name: "resolve_comment", summary: "Resolve or reopen a thread by its first comment", params: ["id", "resolved?"], write: true, run: (c, p) => cres(c.store.resolveComment(p.id, c.author, p.resolved !== false)) },

  { name: "vote_comment", summary: "Upvote (1), downvote (-1) or clear (0) another person's comment", params: ["id", "value"], write: true, run: (c, p) => cres(c.store.voteComment(p.id, c.author, Number(p.value))) },
];

/** A free Kage id derived from a base string (the source title, usually). */
function uniqueKageId(store: { exists: (name: string) => boolean }, base: string): string {
  let slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "kage";
  if (!/^[a-z]/.test(slug)) slug = "k-" + slug;
  if (!store.exists(slug)) return slug;
  for (let i = 2; ; i++) { const cand = slug.slice(0, 36) + "-" + i; if (!store.exists(cand)) return cand; }
}

function toResult(w: { ok: boolean; version?: unknown; validation?: unknown; error?: { code: string; msg: string } }, candidate?: KageDoc | (() => KageDoc | undefined)): OpResult {
  if (w.ok) return ok({ version: w.version, validation: w.validation });
  // A rejection for invalid content explains itself: every finding, with a fix.
  const validation = w.validation as { errors?: unknown[]; warnings?: unknown[] } | undefined;
  if (w.error!.code !== "invalid_content" || !validation) return fail(w.error!.code, w.error!.msg);
  let advice: Advice[] = [];
  try { const doc = typeof candidate === "function" ? candidate() : candidate; if (doc) advice = advise(doc, validation as never); } catch { /* advice is a courtesy; never mask the real error */ }
  return fail(w.error!.code, w.error!.msg, { errors: validation.errors ?? [], warnings: validation.warnings ?? [], advice });
}

/** One readable block for adapters that carry only text (MCP, CLI): each finding
 *  on a line, with its fix underneath. */
export function formatDetails(details: unknown): string {
  const d = details as { errors?: { at: string; code: string; msg: string }[]; warnings?: { at: string; code: string; msg: string }[]; advice?: Advice[] } | undefined;
  if (!d) return "";
  const lines: string[] = [];
  for (const e of d.errors ?? []) lines.push(`  ✗ ${e.at}  ${e.code}  ${e.msg}`);
  for (const w of d.warnings ?? []) lines.push(`  ⚠ ${w.at}  ${w.code}  ${w.msg}`);
  for (const a of d.advice ?? []) if (a.fix) lines.push(`  → ${a.at}  ${a.fix}`);
  return lines.length ? "\n" + lines.join("\n") : "";
}
function toClaim(r: { ok: boolean; heldBy?: string }): OpResult {
  return r.ok ? ok({ claimed: true }) : fail("claimed", `already claimed by ${r.heldBy}`);
}

const BY_NAME = new Map(OPERATIONS.map((o) => [o.name, o]));

/** True if an operation mutates the store. Adapters use this to refuse writes
 *  over read-only transports (e.g. an HTTP GET). Unknown op → treated as a
 *  write, so a typo can't smuggle a mutation through a GET. */
export function isWriteOp(op: string): boolean {
  const spec = BY_NAME.get(op);
  return spec ? !!spec.write : true;
}

/** The single dispatch every adapter calls. Unknown op or a throwing handler
 *  both become a structured error — an adapter never sees an exception. */
export function dispatch(ctx: OpContext, op: string, params: Params = {}): OpResult {
  const spec = BY_NAME.get(op);
  if (!spec) return fail("unknown_operation", `no operation '${op}'`);
  try {
    return spec.run(ctx, params);
  } catch (e) {
    return fail("internal", (e as Error).message);
  }
}
