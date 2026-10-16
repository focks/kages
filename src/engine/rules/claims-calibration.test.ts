// A calibration run for the claims rule: realistic marketing copy that SHOULD be
// flagged and realistic documentation that should NOT. It is the evidence behind
// shipping the rule as P2 / deep tier, and it fails loudly if a pattern change
// trades precision for recall. Add real false positives here when they are found.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findClaims } from "./claim-patterns.ts";

const MARKETING = [
  "Join 12,000 teams who ship faster with Orbit.", "Cut your cloud bill by 38% in the first month.", "Our customers see a 3x lift in conversion.",
  "Trusted by over 2,500 companies, from startups to the Fortune 500.", "99.99% uptime, backed by an SLA.", "Save $1.2M a year on support costs.",
  "“We doubled our pipeline in a quarter.” — Maria Chen, VP Sales at Northwind", "The fastest way to build internal tools.", "Loved by 40k+ developers worldwide.",
  "Reduce onboarding time by 70%.", "Used by more than 800 businesses in 30 countries.", "Best-in-class analytics, built for scale.",
];
const DOCS = [
  "Run the installer, then open a terminal and run `kages init`. This takes about 2 minutes.", "The CLI supports 3 output formats: text, JSON and markdown.", "Set the timeout to 30 seconds for slow networks.",
  "Version 2.4 adds support for 5 new block types.", "Click the third tab, then choose option 2 from the menu.", "A workspace can contain up to 20 projects.",
  "Each comment is limited to 4,000 characters.", "The default quota is 120 versions per hour per principal.", "Open the file at line 42 and replace the value with 7.",
  "Reader accounts can be created for up to 75 consumers by default.", "Press Ctrl+K to open the command palette.", "The server listens on port 3100 unless PORT is set.",
  "Use two spaces for indentation and wrap lines at 100 columns.", "The first step is to create a share; the second is to grant access.", "Charts accept at most 12 slices; more are grouped under Other.",
  "Add 4 columns to the grid and set the gap to step 3.", "We recommend reviewing each change before you publish it.", "In 2026 the format moved to version 1.0.",
];

test("recall: the marketing set is flagged", () => {
  const missed = MARKETING.filter((t) => findClaims(t).length === 0);
  assert.deepEqual(missed, [], `unflagged marketing claims: ${missed.join(" | ")}`);
});

test("precision: ordinary documentation is not flagged", () => {
  const flagged = DOCS.filter((t) => findClaims(t).length > 0).map((t) => `${t} → ${findClaims(t).map((c) => c.kind)}`);
  assert.deepEqual(flagged, [], "false positives");
});

test("overall precision on the calibration set is at least 90% (it is 100% today)", () => {
  const tp = MARKETING.filter((t) => findClaims(t).length > 0).length, fp = DOCS.filter((t) => findClaims(t).length > 0).length;
  assert.ok(tp / (tp + fp) >= 0.9);
});
