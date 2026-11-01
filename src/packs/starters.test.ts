// The picker leads with a curated review brief and retains an explicit blank page.
// Every offered document must be valid before a person creates it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { starterDocs } from "./starters.ts";
import { validate } from "../engine/validate.ts";

test("every starter (including the blank canvas) validates clean", () => {
  const starters = starterDocs();
  assert.ok(starters.some((d) => d.id === "blank"), "blank canvas is offered");
  for (const doc of starters) {
    const r = validate(doc);
    assert.ok(r.ok, `${doc.id} should validate — ${JSON.stringify(r.errors)}`);
  }
});
