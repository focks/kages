// The Studio offers these as one-click starting points — the blank canvas is the
// default landing shape and diverges from the worked examples, so pin that EVERY
// starter (blank included) is a valid document an author can immediately save.

import { test } from "node:test";
import assert from "node:assert/strict";
import { studioStarters } from "./starters.ts";
import { validate } from "../engine/validate.ts";

test("every Studio starter (including the blank canvas) validates clean", () => {
  const starters = studioStarters();
  assert.ok(starters.some((d) => d.id === "blank"), "blank canvas is offered");
  for (const doc of starters) {
    const r = validate(doc);
    assert.ok(r.ok, `${doc.id} should validate — ${JSON.stringify(r.errors)}`);
  }
});
