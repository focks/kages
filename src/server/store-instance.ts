// A process-wide store for the running app, seeded with a few real Kages across
// the three design systems so the dashboard, API and viewer have content. A
// singleton is fine for the in-memory reference implementation; a production
// deployment swaps this for the persistent @kages/store backend behind the same
// interface.
// ponytail: in-memory singleton, replace with the persistent store when one exists.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Store } from "../store/store.ts";
import { toGenerated, fromGenerated } from "../engine/generate.ts";
import { loadSnapshot, saveSnapshot, persistenceEnabled } from "./persistence.ts";
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

let singleton: Store | null = null;
let initPromise: Promise<Store> | null = null;

/** The process store. With Supabase env vars set, the first call restores the
 *  persisted snapshot (or seeds + saves if the row is empty); otherwise it seeds
 *  a fresh in-memory store, exactly as before. The init promise is cached so
 *  concurrent requests on a cold start share one initialisation. */
export async function getStore(): Promise<Store> {
  if (singleton) return singleton;
  if (!initPromise) initPromise = initStore();
  return initPromise;
}

/** Persist the store's current snapshot (no-op without Supabase env). Called by
 *  the API route after a successful write so durability tracks the in-memory
 *  state without the store layer knowing anything about the database. */
export async function persistStore(store: Store): Promise<void> {
  if (persistenceEnabled()) await saveSnapshot(store.snapshot());
}

async function initStore(): Promise<Store> {
  const snap = await loadSnapshot();
  if (snap) { singleton = Store.restore(snap); return singleton; }
  const store = seed(new Store({ workspace: "acme" }));
  if (persistenceEnabled()) await saveSnapshot(store.snapshot());
  singleton = store;
  return store;
}

function seed(store: Store): Store {
  // Seed across three projects (repos) so the workspace has real structure:
  // ops, finance, growth. Both principals are owners of each. Creating into a
  // new project auto-grants the creator (see Store.create), so the UI can open
  // fresh projects too.
  for (const p of [DEMO_PRINCIPAL.principal, ANALYST.principal])
    for (const repo of ["ops", "finance", "growth"]) store.grant(p, repo, ["write", "publish", "review", "admin"]);

  try {
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
