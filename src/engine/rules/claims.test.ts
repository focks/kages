import { test } from "node:test";
import assert from "node:assert/strict";
import { findClaims, type ClaimKind } from "./claim-patterns.ts";
import { isCovered } from "./unsourced-claim.ts";
import { lintDetailed } from "../advice.ts";
import { tree } from "./fixtures.ts";
import { freeFlowExamples, expressiveExamples, richExamples, appExamples, connectedExamples, chartExamples, contentExamples } from "../../packs/examples.ts";
import type { Block, KageBrief } from "../types.ts";

const kinds = (t: string): ClaimKind[] => findClaims(t).map((c) => c.kind);
const has = (t: string, k: ClaimKind) => kinds(t).includes(k);

const POS: Record<ClaimKind, string[]> = {
  metric: ["99.9% uptime guaranteed.", "We cut costs by 40% in the first quarter.", "Teams ship 3× faster with Atlas.", "Customers save $2M a year on average.", "Reduce churn by 12% within weeks.", "Latency dropped 85% after the migration.", "Boost conversion by 2x with one change."],
  reach: ["Trusted by 500+ teams worldwide.", "Used by 10,000 customers.", "Join 25,000 developers building with us.", "Loved by over 2 million people.", "Serving 300 companies today.", "More than 1,200 businesses rely on it."],
  superlative: ["The fastest way to ship.", "Best-in-class security.", "We are #1 in support.", "An industry-leading platform.", "The only tool you will need.", "World-class reliability.", "Unmatched performance."],
  testimonial: ["“This tool changed how our whole team works every single day.” — Jane Doe, CTO at Acme", "\"We could not have launched without it, truly transformative.\" - Sam Lee, Head of Product", "“Best purchase we made this year by a mile.” — Priya N."],
};
const NEG: Record<ClaimKind, string[]> = {
  metric: ["Follow these 3 steps.", "Released in version 2.4.1.", "Open on 12 March 2026.", "Pick one of 5 plans.", "Page 3 of 10.", "Set the opacity to 50%.", "Press x to close."],
  reach: ["Assign 3 teams to the project.", "Invite 5 users to the workspace.", "Each of the 2 customers gets a login.", "Pick 4 developers for the review."],
  superlative: ["The fastest route is shown below.", "It is the best fit for this layout.", "The only argument is the path.", "A leading edge on the table."],
  testimonial: ["He said that \"it works\" and moved on.", "Quote the CLI flag \"--dry-run\" in docs.", "Read the \"Getting started\" guide first."],
};

test("pattern table: every kind matches its positives and ignores its negatives", () => {
  for (const [kind, strings] of Object.entries(POS) as [ClaimKind, string[]][]) {
    assert.ok(strings.length >= 3);
    for (const t of strings) assert.ok(has(t, kind), `${kind} should match: ${t} (got ${kinds(t)})`);
  }
  for (const [kind, strings] of Object.entries(NEG) as [ClaimKind, string[]][]) for (const t of strings) assert.ok(!has(t, kind), `${kind} should NOT match: ${t}`);
});

test("hostile text: a megabyte of near-matches stays fast", () => {
  for (const t of ["9".repeat(100_000) + "%", ("trusted by " + "1".repeat(50) + " ").repeat(5000), "“" + "a".repeat(200_000), ("x ".repeat(100_000))]) {
    const t0 = Date.now();
    findClaims(t);
    assert.ok(Date.now() - t0 < 500, `slow on ${t.slice(0, 20)}`);
  }
});

const doc = (blocks: Record<string, Block>, brief?: KageBrief, extra = {}) => tree({ root: { type: "stack", props: {}, slots: { children: Object.keys(blocks) } }, ...blocks }, { ...(brief ? { brief } : {}), ...extra });
const claims = (d: ReturnType<typeof doc>, opts = {}) => lintDetailed(d, opts).findings.filter((f) => f.rule === "unsourced-claim" || f.rule === "stat-literal-unsourced");
const hero: Record<string, Block> = { h: { type: "section", props: { title: "Atlas", description: "Trusted by 500+ teams. Ship 3x faster. The fastest way to ship." } } };

test("mode matrix: the same text in each mode", () => {
  const f = (mode?: "read" | "operate" | "persuade" | "experience") => claims(doc(hero, mode ? { mode } : undefined)).map((x) => x.severity).sort();
  assert.deepEqual(f("persuade"), ["P2", "P2", "P3"]);
  assert.deepEqual(f("experience"), ["P2", "P2", "P3"]);
  assert.deepEqual(f("operate"), []);
  assert.deepEqual(f("read"), [], "no testimonial in this text");
  assert.deepEqual(f(), [], "mode unknown: only testimonials are checked");
  const quote = doc({ q: { type: "text", props: { text: "“It changed how we work every single day.” — Jane Doe, CTO" } } }, { mode: "read" });
  assert.equal(claims(quote).length, 1, "a testimonial is flagged even when reading");
  assert.equal(claims(doc({ q: { type: "text", props: { text: "“It changed how we work every single day.” — Jane Doe, CTO" } } })).length, 1, "and when the mode is unknown");
});

test("coverage: by claim text, by block id; a note, an empty source or a missing source do not cover", () => {
  const ev = (e: KageBrief["evidence"]) => claims(doc(hero, { mode: "persuade", evidence: e })).length;
  assert.equal(ev(undefined), 3);
  assert.equal(ev([{ claim: "500+ TEAMS", source: "https://x.test" }]), 2, "case-insensitive substring of the offending text");
  assert.equal(ev([{ block: "h", source: "https://x.test" }]), 0, "a block-level source covers all its claims");
  assert.equal(ev(["we have 500 teams, trust us"]), 3, "a free-form note is not a source");
  assert.equal(ev([{ claim: "500+ teams", source: "" }]), 3);
  assert.equal(ev([{ claim: "500+ teams", source: "  " }]), 3);
  assert.equal(isCovered([{ claim: "x", source: "s" }], "nothing", "b"), false);
});

test("an illustrative label suppresses figures and reach, never testimonials", () => {
  const labelled: Record<string, Block> = { ...hero, n: { type: "alert", props: { tone: "warning", title: "Preview", text: "These figures are illustrative." } }, q: { type: "text", props: { text: "“It changed how we work every single day.” — Jane Doe, CTO" } } };
  const f = claims(doc(labelled, { mode: "persuade" }));
  assert.deepEqual(f.map((x) => x.msg.includes("testimonial")), [true]);
});

test("escalation: a workspace that forbids testimonials makes one P1", () => {
  const d = doc({ q: { type: "text", props: { text: "“It changed how we work every single day.” — Jane Doe, CTO" } } }, { mode: "persuade" });
  assert.equal(claims(d)[0].severity, "P2");
  const esc = claims(d, { absent: ["testimonials", "customers"] });
  assert.equal(esc[0].severity, "P1");
  assert.match(esc[0].msg, /must not be invented/);
});

test("data and identifiers are not claims: chart series, table cells, code fences, bound props, hrefs", () => {
  const blocks: Record<string, Block> = {
    c: { type: "bar-chart", props: { label: "Growth", items: [{ label: "Boost 40% faster", value: 40 }] } },
    t: { type: "table", props: { columns: [{ key: "a", label: "Saved 90%" }], rows: [{ a: "Trusted by 500 teams" }] } },
    m: { type: "markdown", props: { text: "```\nTrusted by 500 teams, 3x faster\n```" } },
    b: { type: "text", props: { text: "x" }, bind: { text: { $tpl: "Trusted by {{state.n}} teams" } as never } },
    l: { type: "link", props: { label: "Docs", href: "https://x.test/trusted-by-500-teams" } },
  };
  assert.deepEqual(claims(doc(blocks, { mode: "persuade" })), []);
});

test("stat-literal-unsourced: typed numbers are flagged, bound ones are not, a block source covers", () => {
  const stat = (p: Record<string, unknown>, bind?: Record<string, unknown>): Record<string, Block> => ({ s: { type: "stat", props: { label: "Customers", ...p }, ...(bind ? { bind: bind as never } : {}) } });
  const f = (blocks: Record<string, Block>, brief: KageBrief) => claims(doc(blocks, brief, { data: { rows: [1] } })).filter((x) => x.rule === "stat-literal-unsourced");
  assert.equal(f(stat({ value: 1200 }), { mode: "operate" }).length, 1);
  assert.equal(f(stat({ value: "1,200" }), { mode: "persuade" }).length, 1);
  assert.equal(f(stat({}, { value: { $count: { $data: "rows" } } }), { mode: "operate" }).length, 0);
  assert.equal(f(stat({ value: "n/a" }), { mode: "operate" }).length, 0, "text without a digit is not a figure");
  assert.equal(f(stat({ value: 1200 }), { mode: "read" }).length, 0, "not checked when reading");
  assert.equal(f(stat({ value: 1200 }), { mode: "operate", evidence: [{ block: "s", source: "CRM export 2026-10-01" }] }).length, 0);
  assert.equal(f(stat({ value: 1200 }), { mode: "operate", evidence: [{ claim: "Customers 1200", source: "CRM" }] }).length, 0);
});

test("corpus guard: shipped examples raise no claim findings in any declared mode", () => {
  for (const id of ["core", "ledger", "atelier"]) {
    const docs = [...freeFlowExamples(id), ...expressiveExamples(id), ...richExamples(id), ...appExamples(id), ...connectedExamples(id), ...chartExamples(id), ...contentExamples(id)];
    for (const d of docs) assert.deepEqual(claims(d as never, { system: id }), [], `${id}/${d.id}`);
  }
});
