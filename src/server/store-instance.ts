// A process-wide store for the running app, seeded with a few real Kages across
// the three design systems so the dashboard, API and viewer have content. A
// cache is authoritative only in memory; persistent reads reload committed snapshots.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Store } from "../store/store.ts";
import { toGenerated, fromGenerated } from "../engine/generate.ts";
import { loadSnapshotRev, casSave, persistenceEnabled } from "./persistence.ts";
import { introTemplates } from "./templates.ts";
import { freeFlowExamples, expressiveExamples, richExamples, appExamples, connectedExamples, chartExamples, contentExamples } from "../packs/examples.ts";
import type { OpResult } from "../adapters/operations.ts";
import type { Provenance } from "../store/types.ts";
import type { KageDoc } from "../engine/types.ts";

export const DEMO_PRINCIPAL: Provenance = {
  principal: "agent:acme/demo",
  runtime: { framework: "next", model: "n/a", adapter: "rest" },
  run: "run_demo",
};

const ANALYST: Provenance = { principal: "agent:acme/analyst", runtime: { framework: "crewai", model: "x/y", adapter: "mcp" }, run: "run_a" };

/** Fork the reference Kage into another system with a new id/title, via the
 *  generation round trip — the same path an agent uses to retarget a template. */
function fork(base: KageDoc, system: string, id: string, title: string): KageDoc {
  const doc = fromGenerated(toGenerated(base, system), system);
  return { ...doc, id, title };
}

const stores = new Map<string, Store>();
const initPromises = new Map<string, Promise<Store>>();

/** The store for a workspace (default "acme" — the local/anonymous workspace).
 *  With Supabase set, the first call restores that workspace's persisted snapshot
 *  (or seeds + saves if its row is empty); otherwise it seeds in-memory. Each
 *  workspace is cached independently so a signed-in user's data never mixes with
 *  another's. The init promise is cached so concurrent cold-start requests share
 *  one initialisation. */
export async function getStore(workspace = "acme"): Promise<Store> {
  // Persistent reads must observe other instances' commits, including revocations.
  if (persistenceEnabled()) return initStore(workspace);
  const cached = stores.get(workspace);
  if (cached) return cached;
  if (!initPromises.has(workspace)) initPromises.set(workspace, initStore(workspace));
  return initPromises.get(workspace)!;
}

/** Run a write against a workspace with optimistic concurrency. Without Supabase
 *  the cached in-memory store is the single source of truth (local/tests), so the
 *  op applies directly. With Supabase, each attempt loads the LATEST snapshot,
 *  applies the op to it, and commits only if the revision hasn't moved — retrying
 *  on conflict — so a stale serverless instance can neither lose a write nor
 *  resurrect a deleted Kage. `apply` returns the op result plus an optional
 *  `after` hook (public-share sync) that runs only once the write is committed. */
export async function mutateStore(
  workspace: string,
  apply: (store: Store) => { result: OpResult; after?: () => Promise<void> },
): Promise<OpResult> {
  if (!persistenceEnabled()) {
    const store = await getStore(workspace);
    const { result, after } = apply(store);
    if (result.ok && after) await after();
    return result;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const loaded = await loadSnapshotRev(workspace);
    const store = loaded ? Store.restore(loaded.snapshot) : buildSeeded(workspace);
    const { result, after } = apply(store);
    if (!result.ok) return result; // a failed op changed nothing → nothing to commit
    const committed = await casSave(workspace, store.snapshot(), loaded ? loaded.rev : null);
    if (committed) {
      if (after) await after();
      return result;
    }
    // revision moved under us → reload and re-apply against the fresh state
  }
  return { ok: false, error: { code: "conflict", msg: "workspace changed concurrently; please retry" } };
}

/** Seed a brand-new workspace in memory (no persistence). Shared "acme" gets the
 *  demo content; a user's own workspace gets the intro templates. */
function buildSeeded(workspace: string): Store {
  const store = new Store({ workspace });
  if (workspace === "acme") seed(store);
  else seedStarters(store, workspace);
  return store;
}

async function initStore(workspace: string): Promise<Store> {
  if (!persistenceEnabled()) {
    const store = buildSeeded(workspace);
    stores.set(workspace, store);
    return store;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const loaded = await loadSnapshotRev(workspace);
    const store = loaded ? Store.restore(loaded.snapshot) : buildSeeded(workspace);
    if (loaded && !backfillExamples(store, workspace)) return store;
    if (await casSave(workspace, store.snapshot(), loaded?.rev ?? null)) return store;
    // A competing seed or backfill won. Reload its committed data, never our candidate.
  }
  throw new Error("workspace initialization changed concurrently; please retry");
}

/** Add any shipped example documents that a persisted workspace lacks, into its
 *  `templates` repo, as the principal that originally seeded it. Never touches an
 *  existing document (users may have edited a template), so it is idempotent.
 *  Returns whether anything was added. */
function backfillExamples(store: Store, workspace: string): boolean {
  const owner: Provenance = workspace === "acme" ? DEMO_PRINCIPAL : { principal: "user:" + workspace.replace(/^ws-/, ""), runtime: { framework: "next", adapter: "rest" } };
  let added = false;
  for (const doc of [...freeFlowExamples(), ...expressiveExamples(), ...richExamples(), ...appExamples(), ...connectedExamples(), ...chartExamples(), ...contentExamples()]) {
    if (store.head(doc.id)) continue;
    try { added = store.create("templates", doc, owner).ok || added; } catch { /* best-effort, like seeding */ }
  }
  return added;
}

/** Seed a new user's workspace with a few intro Kages to start from. These are
 *  ordinary Kages (not a separate "template" type) in a `getting-started`
 *  project — the user clones any of them, or just edits in place. The workspace
 *  is `ws-<userId>`; the owner principal is `user:<userId>`. */
function seedStarters(store: Store, workspace: string): void {
  const principal = "user:" + workspace.replace(/^ws-/, "");
  const owner: Provenance = { principal, runtime: { framework: "next", adapter: "rest" } };
  store.grant(principal, "getting-started", ["write", "publish", "review", "admin"]);
  store.grant(principal, "templates", ["write", "publish", "review", "admin"]);
  try {
    // search_templates discovers the templates repo. Keep the free-flow
    // examples there so the guidance to fork a starter also works for agents.
    const exampleIds = new Set([...freeFlowExamples(), ...expressiveExamples(), ...richExamples(), ...appExamples(), ...connectedExamples(), ...chartExamples(), ...contentExamples()].map((doc) => doc.id));
    for (const t of introTemplates()) store.create(exampleIds.has(t.id) ? "templates" : "getting-started", t, owner);
  } catch {
    /* best-effort: an empty workspace is still valid */
  }
}

function seed(store: Store): Store {
  // Seed across three projects (repos) so the workspace has real structure:
  // ops, finance, growth. Both principals are owners of each. Creating into a
  // new project auto-grants the creator (see Store.create), so the UI can open
  // fresh projects too.
  for (const p of [DEMO_PRINCIPAL.principal, ANALYST.principal])
    for (const repo of ["ops", "finance", "growth", "templates"]) store.grant(p, repo, ["write", "publish", "review", "admin"]);

  try {
    for (const doc of [...freeFlowExamples(), ...expressiveExamples(), ...richExamples(), ...appExamples(), ...connectedExamples(), ...chartExamples(), ...contentExamples()]) store.create("templates", doc, DEMO_PRINCIPAL);
    const base = JSON.parse(readFileSync(join(process.cwd(), "public/ds/ops-console.kage.json"), "utf8")) as KageDoc;

    // ops · the reference console: a second version + published to the workspace.
    store.create("ops", base, DEMO_PRINCIPAL);
    store.patch("ops-console", [{ op: "add", path: "/blocks/kpiRevenue/props/caption", value: "Against the previous week" }], DEMO_PRINCIPAL, { summary: "add revenue caption" });
    store.publish("ops-console", DEMO_PRINCIPAL, "workspace");

    // finance · a Ledger revenue board, published public.
    store.create("finance", fork(base, "ledger", "revenue-board", "Revenue board"), ANALYST);
    store.publish("revenue-board", ANALYST, "public");

    // growth · an Atelier weekly story, left in draft.
    store.create("growth", fork(base, "atelier", "weekly-story", "Weekly story"), DEMO_PRINCIPAL);

    // finance · a Ledger churn watchlist, submitted for review.
    store.create("finance", fork(base, "ledger", "churn-watchlist", "Churn watchlist"), ANALYST);
    store.submitForReview("churn-watchlist", ANALYST);

    // ops · a Core launch checklist, published then deprecated.
    store.create("ops", fork(base, "core", "launch-checklist", "Launch checklist"), DEMO_PRINCIPAL);
    store.publish("launch-checklist", DEMO_PRINCIPAL, "workspace");
    store.deprecate("launch-checklist", DEMO_PRINCIPAL);
  } catch {
    // Seeding is best-effort; an empty store is still a valid store.
  }

  return store;
}
