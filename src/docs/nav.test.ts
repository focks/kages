import { test } from "node:test";
import assert from "node:assert/strict";
import { docsNav } from "./nav.ts";

const p = (slug: string, group: string) => ({ slug, title: slug, group });

test("pages are grouped in first-seen order", () => {
  const nav = docsNav([p("concepts", "Start"), p("decision-guides", "Guides"), p("collaboration", "Guides"), p("cli", "Reference")]);
  assert.deepEqual(nav.map((g) => g.group), ["Start", "Guides", "Reference"]);
  assert.deepEqual(nav[1].items.map((n) => n.slug), ["decision-guides", "collaboration"]);
});
