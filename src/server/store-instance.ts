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

export function getStore(): Store {
  if (singleton) return singleton;
  const store = new Store({ workspace: "acme" });
  for (const p of [DEMO_PRINCIPAL.principal, ANALYST.principal]) store.grant(p, "kages", ["write", "publish", "review", "admin"]);

  try {
    const base = JSON.parse(readFileSync(join(process.cwd(), "public/ds/ops-console.kage.json"), "utf8")) as KageDoc;

    // 1. The reference console: a second version + published to the workspace.
    store.create("kages", base, DEMO_PRINCIPAL);
    store.patch("ops-console", [{ op: "add", path: "/blocks/kpiRevenue/props/caption", value: "Against the previous week" }], DEMO_PRINCIPAL, { summary: "add revenue caption" });
    store.publish("ops-console", DEMO_PRINCIPAL, "workspace");

    // 2. A Ledger revenue board, published public.
    store.create("kages", fork(base, "ledger", "revenue-board", "Revenue board"), ANALYST);
    store.publish("revenue-board", ANALYST, "public");

    // 3. An Atelier weekly story, left in draft.
    store.create("kages", fork(base, "atelier", "weekly-story", "Weekly story"), DEMO_PRINCIPAL);

    // 4. A Ledger churn watchlist, submitted for review.
    store.create("kages", fork(base, "ledger", "churn-watchlist", "Churn watchlist"), ANALYST);
    store.submitForReview("churn-watchlist", ANALYST);

    // 5. A Core launch checklist, published then deprecated.
    store.create("kages", fork(base, "core", "launch-checklist", "Launch checklist"), DEMO_PRINCIPAL);
    store.publish("launch-checklist", DEMO_PRINCIPAL, "workspace");
    store.deprecate("launch-checklist", DEMO_PRINCIPAL);
  } catch {
    // Seeding is best-effort; an empty store is still a valid store.
  }

  singleton = store;
  return store;
}
