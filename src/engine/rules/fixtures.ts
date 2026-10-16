// One positive and one negative document per rule. The registry test requires an
// entry here for every registered rule, so a rule cannot land without proof that
// it both fires and stays quiet.
import type { Block, KageDoc } from "../types.ts";

type Blocks = Record<string, Block>;
export const mk = (blocks: Blocks, extra: Partial<KageDoc> = {}): KageDoc => ({
  kages: "1.0", id: "fx", title: "Fixture", system: "core@1", root: "root",
  blocks: { root: { type: "stack", props: {}, slots: { children: Object.keys(blocks) } }, ...blocks },
  ...extra,
} as KageDoc);

/** A document whose tree is exactly as written (mk() flattens everything under one stack). */
export const tree = (blocks: Blocks, extra: Partial<KageDoc> = {}): KageDoc => ({ kages: "1.0", id: "fx", title: "Fixture", system: "core@1", root: "root", blocks, ...extra } as KageDoc);

const btn = (on?: Block["on"]): Blocks => ({ b: { type: "button", props: { label: "Go" }, ...(on ? { on } : {}) } });
const click = { click: [{ do: "set", path: "x", value: 1 }] } as unknown as Block["on"];

/** Options a rule needs to be exercised (an injected registry, for rules whose shipped data is empty). */
export const FIXTURE_OPTIONS: Record<string, import("../advice.ts").LintOptions> = {
  "deprecated-usage": { deprecations: [{ id: "text-legacy", kind: "prop", target: { role: "text" }, prop: "legacy", since: "core@9", reason: "retired for the fixture", replacement: { prop: "modern" }, migration: { op: "rename-prop", to: "modern" }, auto: true }] },
};

export const FIXTURES: Record<string, { pos: KageDoc; neg: KageDoc }> = {
  "dead-button": { pos: mk(btn()), neg: mk(btn(click), { state: { x: 0 } }) },
  "form-unwired": {
    pos: mk({ f: { type: "form", props: { label: "F" } } }),
    neg: mk({ f: { type: "form", props: { label: "F" }, on: { submit: [{ do: "set", path: "x", value: 1 }] } as never } }, { state: { x: 0 } }),
  },
  "modal-unreachable": {
    pos: mk({ m: { type: "modal", props: { label: "M" } } }),
    neg: mk({ m: { type: "modal", props: { label: "M" }, visible: { $state: "open" } as never } }, { state: { open: false } }),
  },
  "toc-missing-anchor": {
    pos: mk({ t: { type: "toc", props: { items: [{ label: "A", target: "nope" }] } } }),
    neg: mk({ t: { type: "toc", props: { items: [{ label: "A", target: "a" }] } }, a: { type: "anchor", props: { name: "a" } } }),
  },
  "tab-panel-extra-slot": {
    pos: mk({ p: { type: "tab-panel", props: { label: "P", tabs: [{ id: "a", label: "A" }] }, slots: { panel1: ["x"], panel2: ["y"] } }, x: { type: "text", props: { text: "x" } }, y: { type: "text", props: { text: "y" } } }),
    neg: mk({ p: { type: "tab-panel", props: { label: "P", tabs: [{ id: "a", label: "A" }] }, slots: { panel1: ["x"] } }, x: { type: "text", props: { text: "x" } } }),
  },
  "tab-panel-empty": {
    pos: mk({ p: { type: "tab-panel", props: { label: "P", tabs: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }, slots: { panel1: ["x"] } }, x: { type: "text", props: { text: "x" } } }),
    neg: mk({ p: { type: "tab-panel", props: { label: "P", tabs: [{ id: "a", label: "A" }] }, slots: { panel1: ["x"] } }, x: { type: "text", props: { text: "x" } } }),
  },
  "duplicate-item-id": {
    pos: mk({ a: { type: "accordion", props: { items: [{ id: "q", title: "1", body: "a" }, { id: "q", title: "2", body: "b" }] } } }),
    neg: mk({ a: { type: "accordion", props: { items: [{ id: "q1", title: "1", body: "a" }, { id: "q2", title: "2", body: "b" }] } } }),
  },
  "insecure-media": {
    pos: mk({ v: { type: "video", props: { label: "V", src: "http://x.test/a.mp4" } } }),
    neg: mk({ v: { type: "video", props: { label: "V", src: "https://x.test/a.mp4" } } }),
  },
  "empty-chart": {
    pos: mk({ c: { type: "bar-chart", props: { label: "C", items: [] } } }),
    neg: mk({ c: { type: "bar-chart", props: { label: "C", items: [{ label: "a", value: 1 }] } } }),
  },
  "selection-unused": {
    pos: mk({ c: { type: "donut-chart", props: { label: "C", interactive: true, items: [{ label: "a", value: 1 }] } } }),
    neg: mk({ c: { type: "donut-chart", props: { label: "C", interactive: true, items: [{ label: "a", value: 1 }] } }, t: { type: "text", props: {}, bind: { text: { $block: "c.selected" } as never } } }),
  },
  "calendar-month": {
    pos: mk({ c: { type: "calendar", props: { label: "C", month: "March" } } }),
    neg: mk({ c: { type: "calendar", props: { label: "C", month: "2026-03" } } }),
  },
  "tpl-missing-block": {
    pos: mk({ t: { type: "text", props: {}, bind: { text: { $tpl: "{{block.ghost.value}}" } as never } } }),
    neg: mk({ i: { type: "text-input", props: { label: "I" } }, t: { type: "text", props: {}, bind: { text: { $tpl: "{{block.i.value}}" } as never } } }),
  },
  "tpl-private-read": {
    pos: mk({ i: { type: "text-input", props: { label: "I" } }, t: { type: "text", props: {}, bind: { text: { $tpl: "{{block.i.secret}}" } as never } } }),
    neg: mk({ i: { type: "text-input", props: { label: "I" } }, t: { type: "text", props: {}, bind: { text: { $tpl: "{{block.i.value}}" } as never } } }),
  },
  "tpl-undeclared-state": {
    pos: mk({ t: { type: "text", props: {}, bind: { text: { $tpl: "{{state.nme}}" } as never } } }, { state: { name: "" } }),
    neg: mk({ t: { type: "text", props: {}, bind: { text: { $tpl: "{{state.name}}" } as never } } }, { state: { name: "" } }),
  },
  "nested-sections": {
    pos: tree({ root: { type: "page", props: {}, slots: { children: ["c"] } }, c: { type: "card", props: { title: "Outer" }, slots: { children: ["d"] } }, d: { type: "card", props: { title: "Inner" } } }),
    neg: tree({ root: { type: "page", props: {}, slots: { children: ["c"] } }, c: { type: "card", props: { title: "Outer" }, slots: { children: ["t"] } }, t: { type: "text", props: { text: "plain" } } }),
  },
  // The shipped registry is empty; FIXTURE_OPTIONS injects a one-entry registry for this rule.
  "deprecated-usage": { pos: mk({ t: { type: "text", props: { text: "x", legacy: true } } }), neg: mk({ t: { type: "text", props: { text: "x" } } }) },
  "unsourced-claim": {
    pos: mk({ t: { type: "text", props: { text: "Trusted by 500+ teams worldwide." } } }, { brief: { mode: "persuade" } }),
    neg: mk({ t: { type: "text", props: { text: "Trusted by 500+ teams worldwide." } } }, { brief: { mode: "persuade", evidence: [{ claim: "500+ teams", source: "https://example.test/customers" }] } }),
  },
  "stat-literal-unsourced": {
    pos: mk({ s: { type: "stat", props: { label: "Customers", value: 1200 } } }, { brief: { mode: "operate" } }),
    neg: mk({ s: { type: "stat", props: { label: "Customers" }, bind: { value: { $count: { $data: "rows" } } as never } } }, { brief: { mode: "operate" }, data: { rows: [1, 2] } }),
  },
  "brief-invalid": {
    pos: mk({ a: { type: "text", props: { text: "a" } } }, { brief: { mode: "loud" } } as never),
    neg: mk({ a: { type: "text", props: { text: "a" } } }, { brief: { mode: "read", audience: "Partners" } }),
  },
  "unreachable-block": {
    pos: mk({ a: { type: "text", props: { text: "a" } } }, { blocks: { root: { type: "stack", props: {} }, a: { type: "text", props: { text: "a" } } } } as never),
    neg: mk({ a: { type: "text", props: { text: "a" } } }),
  },
};
