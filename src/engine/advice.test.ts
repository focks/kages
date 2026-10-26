// Advice and lint: concrete fixes for validator findings, and pitfalls the
// validator allows. Every rule has a failing and a passing case, shipped
// documents must stay lint-clean, and advice never changes validity.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { advise, lint, review, nearest, type Advice } from "./advice.ts";
import { validate } from "./validate.ts";
import { freeFlowExamples, expressiveExamples, richExamples, appExamples, connectedExamples, chartExamples, contentExamples } from "../packs/examples.ts";
import type { KageDoc } from "./types.ts";

const doc = (blocks: KageDoc["blocks"], extra: Partial<KageDoc> = {}): KageDoc => ({ kages: "1.0", id: "t", title: "T", system: "core@1", root: "root", blocks: { root: { type: "page", slots: { children: Object.keys(blocks).filter((k) => k !== "root") } }, ...blocks }, ...extra });
const codes = (a: { code: string }[]) => a.map((x) => x.code).sort();
const one = (a: Advice[], code: string) => { const f = a.find((x) => x.code === code); assert.ok(f, `expected advice ${code}, got ${codes(a)}`); return f!; };

test("nearest suggests a plausible typo fix, and nothing for a coincidence", () => {
  const types = ["bar-chart", "line-chart", "stat", "table", "dropdown"];
  assert.equal(nearest("bar-chrt", types), "bar-chart"); assert.equal(nearest("Stat", types), "stat"); assert.equal(nearest("tabel", types), "table"); assert.equal(nearest("barchart", types), "bar-chart", "a missing separator is one edit");
  assert.equal(nearest("zzzzzz", types), undefined); assert.equal(nearest("", types), undefined); assert.equal(nearest("x", []), undefined);
});

test("unresolved-type: names the nearest installed type, else points to the catalog", () => {
  const typo = doc({ c: { type: "bar-chrt", props: { label: "x", items: [] } } });
  const hit = one(advise(typo, validate(typo)), "unresolved-type"); assert.match(hit.fix!, /Did you mean `bar-chart`/); assert.equal(hit.level, "hint"); assert.equal(hit.at, "/blocks/c/type");
  const wild = doc({ c: { type: "qqqqqqq" } }); assert.match(one(advise(wild, validate(wild)), "unresolved-type").fix!, /kages catalog core/);
});

test("missing-prop explains the prop's type and enum", () => {
  const d = doc({ g: { type: "grid" }, s: { type: "stat", props: { value: 1 } }, b: { type: "badge", props: {} } });
  const advice = advise(d, validate(d)), missing = advice.filter((a) => a.code === "missing-prop");
  assert.ok(missing.length >= 2); assert.ok(missing.some((a) => /needs its `label` prop \(string/.test(a.msg)));
  assert.match(missing[0].fix!, /bind\./);
});

test("unknown-prop, unknown-slot and slot-max point at the real names", () => {
  const d = doc({ b: { type: "button", props: { label: "Go", varient: "primary" } }, cards: { type: "card", slots: { bodyy: ["t"] } }, t: { type: "text", props: { text: "x" } } });
  const a = advise(d, validate(d));
  assert.match(one(a, "unknown-prop").fix!, /Rename it to `variant`/);
  const slot = one(a, "unknown-slot"); assert.match(slot.msg, /no slot `bodyy`/); assert.match(slot.fix!, /Use slot `body`|Valid slots/);
  const shell = doc({ s: { type: "shell", slots: { sidebar: ["n1", "n2"] } }, n1: { type: "sidebar", props: { title: "A", items: [] } }, n2: { type: "sidebar", props: { title: "B", items: [] } } });
  assert.match(one(advise(shell, validate(shell)), "slot-max").fix!, /stack/);
});

test("dangling references suggest the nearest block id", () => {
  const d = doc({ a: { type: "text", props: { text: "x" }, slots: {} }, wrapper: { type: "stack", slots: { children: ["aa"] } } });
  const a = advise(d, validate(d)), f = one(a, "missing-child"); assert.match(f.fix!, /Did you mean `a`/);
});

test("unknown-event and unknown-command list what the block really offers", () => {
  const d = doc({ b: { type: "button", props: { label: "Go" }, on: { clik: [{ do: "set", path: "x", value: 1 }], click: [{ do: "call", target: "m", command: "opn" }] } }, m: { type: "modal", props: { label: "M" } } }, { state: { x: 0 } });
  const a = advise(d, validate(d));
  assert.match(one(a, "unknown-event").fix!, /on\.click/);
  assert.equal(one(a, "unknown-command").code, "unknown-command"); assert.match(one(a, "unknown-command").msg, /`opn`/);
});

test("private-output tells you what is readable and how to get the value another way", () => {
  const d = doc({ t: { type: "table", props: { columns: [{ key: "a", label: "A" }], rows: [] } }, c: { type: "text", bind: { text: { $block: "t.columns" } } } });
  const hint = one(advise(d, validate(d)), "private-output"); assert.match(hint.msg, /declared outputs/); assert.match(hint.fix!, /rows|\$state/, "names the readable output or the state route");
  const sel = doc({ g: { type: "donut-chart", props: { label: "x", items: [{ label: "a", value: 1 }] } }, c: { type: "text", bind: { text: { $block: "g.selectd" } } } });
  assert.match(one(advise(sel, validate(sel)), "private-output").fix!, /Read `g\.selected` instead/, "a near-miss output is offered by name");
});

test("undeclared-state and missing-source suggest declared names; unknown-action suggests an action", () => {
  const d = doc({ i: { type: "text-field", props: { label: "N" }, bind: { value: { $state: "nmae" } }, on: { change: [{ do: "sett", path: "name", value: { $event: "value" } }, { do: "fetch", source: "ordrs", into: "name" }] } } }, { state: { name: "" }, sources: { orders: { from: "url", url: "https://a.example/o" } as never } });
  const a = advise(d, validate(d));
  assert.match(one(a, "undeclared-state").fix!, /Did you mean `name`/); assert.match(one(a, "unknown-action").fix!, /Use `set`/); assert.match(one(a, "missing-source").fix!, /Did you mean `orders`/);
});

test("the oracle's broken fixture gets a fix for each of its 6 errors", () => {
  const broken = JSON.parse(readFileSync(new URL("./__fixtures__/broken.kage.json", import.meta.url), "utf8")) as KageDoc;
  const v = validate(broken), a = advise(broken, v).filter((x) => x.level === "hint");
  for (const code of ["slot-max", "missing-prop", "unknown-event", "unresolved-type", "private-output", "unknown-command"]) assert.ok(a.some((x) => x.code === code && x.fix), code);
  assert.deepEqual(review(broken).errors, v.errors, "review never alters the validator's own findings");
  assert.equal(review(broken).ok, v.ok);
});

test("lint: dead buttons, unwired forms and unopened modals", () => {
  const bad = doc({ b: { type: "button", props: { label: "Go" } }, f: { type: "form", props: { label: "F" }, slots: { children: [] } }, m: { type: "modal", props: { label: "M" } } });
  assert.deepEqual(codes(lint(bad)), ["dead-button", "form-unwired", "modal-unreachable"]);
  const good = doc({ b: { type: "button", props: { label: "Go" }, on: { click: [{ do: "call", target: "m", command: "open" }] } }, f: { type: "form", props: { label: "F" }, slots: { children: [] }, on: { submit: [{ do: "set", path: "s", value: { $event: "values" } }] } }, m: { type: "modal", props: { label: "M" } } }, { state: { s: null } });
  assert.deepEqual(lint(good), []);
  assert.deepEqual(lint(doc({ m: { type: "modal", props: { label: "M" }, visible: { $state: "open" } } }, { state: { open: false } })), [], "a modal shown by state is reachable");
});

test("lint: tpl reading private outputs or undeclared state renders empty, and says so", () => {
  const d = doc({ t: { type: "table", props: { columns: [{ key: "a", label: "A" }], rows: [] } }, x: { type: "text", bind: { text: { $tpl: "{{block.t.columns}} and {{block.nope.x}} and {{state.nme}}" } } } }, { state: { name: "" } });
  const a = lint(d); assert.deepEqual(codes(a), ["tpl-missing-block", "tpl-private-read", "tpl-undeclared-state"]);
  assert.match(one(a, "tpl-undeclared-state").fix!, /Did you mean `name`/);
  const fine = doc({ i: { type: "text-field", props: { label: "N" } }, x: { type: "text", bind: { text: { $tpl: "{{block.i.value}} {{state.name}}" } } } }, { state: { name: "" } });
  assert.deepEqual(lint(fine), []);
});

test("lint: toc links need anchors; tab panels need matching slots", () => {
  const toc = doc({ a: { type: "anchor", props: { name: "intro" } }, t: { type: "toc", props: { items: [{ label: "Intro", target: "intro" }, { label: "Gone", target: "missing" }] } } });
  const a = lint(toc); assert.deepEqual(codes(a), ["toc-missing-anchor"]); assert.match(a[0].msg, /`missing`/); assert.equal(a[0].at, "/blocks/t/props/items/1");
  const tabs = doc({ p: { type: "tab-panel", props: { label: "T", tabs: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }, slots: { panel1: ["x"], panel3: ["x"] } }, x: { type: "text", props: { text: "x" } } });
  assert.deepEqual(codes(lint(tabs)), ["tab-panel-empty", "tab-panel-extra-slot"]);
});

test("lint: duplicate item ids, insecure media, empty charts, bad calendar month", () => {
  const d = doc({
    acc: { type: "accordion", props: { items: [{ id: "a", title: "1" }, { id: "a", title: "2" }] } },
    v: { type: "video", props: { label: "V", src: "http://cdn.example/x.mp4" } },
    g: { type: "gallery", props: { label: "G", items: [{ src: "http://cdn.example/1.jpg", alt: "x" }] } },
    ch: { type: "treemap", props: { label: "T", items: [] } },
    ok: { type: "treemap", props: { label: "T", items: [] }, bind: { items: { $data: "d" } } },
    cal: { type: "calendar", props: { label: "C", month: "March 2026" } },
  }, { data: { d: [] } });
  const a = lint(d); assert.deepEqual(codes(a), ["calendar-month", "duplicate-item-id", "empty-chart", "insecure-media", "insecure-media"]);
  assert.equal(a.filter((x) => x.code === "empty-chart").length, 1, "a bound chart is not reported");
});

test("lint: an interactive chart nobody reads, and blocks that can never render", () => {
  const lonely = doc({ d: { type: "donut-chart", props: { label: "D", interactive: true, items: [{ label: "a", value: 1 }] } } });
  assert.deepEqual(codes(lint(lonely)), ["selection-unused"]);
  const viaBind = doc({ d: { type: "donut-chart", props: { label: "D", interactive: true, items: [{ label: "a", value: 1 }] } }, t: { type: "text", bind: { text: { $block: "d.selected" } } } });
  assert.deepEqual(lint(viaBind), [], "reading the output counts");
  const viaTpl = doc({ d: { type: "donut-chart", props: { label: "D", interactive: true, items: [{ label: "a", value: 1 }] } }, t: { type: "text", bind: { text: { $tpl: "{{block.d.selected}}" } } } });
  assert.deepEqual(lint(viaTpl), [], "reading it in a template counts");
  const donut = { type: "donut-chart", props: { label: "D", interactive: true, items: [{ label: "a", value: 1 }] }, on: { select: [{ do: "set", path: "s", value: { $event: "label" } }] } };
  const handled = doc({ d: donut }, { state: { s: "" } });
  assert.deepEqual(lint(handled), [], "an on.select handler counts");
  const orphan = doc({ used: { type: "text", props: { text: "x" } }, ghost: { type: "text", props: { text: "never shown" } } }); orphan.blocks.root.slots = { children: ["used"] };
  const a = lint(orphan); assert.deepEqual(codes(a), ["unreachable-block"]); assert.equal(a[0].at, "/blocks/ghost");
  const target = doc({ b: { type: "button", props: { label: "Go" }, on: { click: [{ do: "call", target: "dlg", command: "open" }] } }, dlg: { type: "modal", props: { label: "M" } } }); target.blocks.root.slots = { children: ["b"] };
  assert.deepEqual(lint(target), [], "a block that is only a command target is not 'unreachable'");
});

test("lint: a diagram is a graph too — unwired interactivity and needless explorer chrome", () => {
  const wire = { select: [{ do: "set", path: "s", value: { $event: "id" } }] } as never;
  const nodes = [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges = [{ from: "a", to: "b" }];
  const lonely = doc({ g: { type: "diagram", props: { label: "G", interactive: true, nodes, edges } } });
  assert.deepEqual(codes(lint(lonely)), ["selection-unused"]);
  assert.match(one(lint(lonely), "selection-unused").fix!, /static/i, "the first suggestion is to make it static");
  const unwiredExplore = doc({ g: { type: "diagram", props: { label: "G", explore: true, nodes, edges } } });
  assert.ok(codes(lint(unwiredExplore)).includes("selection-unused"), "explore implies interactive");
  const wired = doc({ g: { type: "diagram", props: { label: "G", interactive: true, nodes, edges }, on: wire } }, { state: { s: "" } });
  assert.deepEqual(lint(wired), [], "a wired interactive diagram is fine");
  const still = doc({ g: { type: "diagram", props: { label: "G", nodes, edges } } });
  assert.deepEqual(lint(still), [], "a static diagram needs no wiring at all");
  const chrome = doc({ g: { type: "diagram", props: { label: "G", explore: true, nodes, edges }, on: wire } }, { state: { s: "" } });
  assert.deepEqual(codes(lint(chrome)), ["needless-explore"], "explorer chrome on a small ungrouped graph");
  const grouped = doc({ g: { type: "diagram", props: { label: "G", explore: true, nodes: nodes.map((n, i) => ({ ...n, group: i ? "Right" : "Left" })), edges }, on: wire } }, { state: { s: "" } });
  assert.deepEqual(lint(grouped), [], "groups give the chrome something to collapse");
  const big = doc({ g: { type: "diagram", props: { label: "G", explore: true, nodes: Array.from({ length: 9 }, (_, i) => ({ id: "n" + i, label: "N" + i })), edges: [] }, on: wire } }, { state: { s: "" } });
  assert.deepEqual(lint(big), [], "nine nodes are worth exploring");
});

test("every document the project ships is lint-clean and its hints add nothing to valid documents", () => {
  const shipped = [...freeFlowExamples(), ...expressiveExamples(), ...richExamples(), ...appExamples(), ...connectedExamples(), ...chartExamples(), ...contentExamples(), JSON.parse(readFileSync(new URL("../../public/ds/ops-console.kage.json", import.meta.url), "utf8"))] as KageDoc[];
  for (const d of shipped) { const r = review(d); assert.deepEqual(r.advice, [], `${d.id}: ${JSON.stringify(r.advice.map((x) => x.code + "@" + x.at))}`); }
});

test("lint and advice never throw on hostile or half-formed documents", () => {
  const weird: any[] = [{}, { blocks: null }, { blocks: { a: null } }, { blocks: { a: { type: 5, props: "x", on: 7, slots: [] } }, root: "a" }, { blocks: { a: { type: "toc", props: { items: [null, 3, { target: {} }] } } }, root: "a" }, { blocks: { a: { type: "button", on: { click: [null, "x", { do: {} }] } } }, root: "zzz" }];
  for (const w of weird) assert.doesNotThrow(() => { lint(w); }, JSON.stringify(w));
});
