// Cross-layer behavior tests pin the public semantics to captured oracle output
// and exercise stateful cases goldens cannot show: filtering, local isolation,
// scoped events and generation round trips. See expressive-artifacts.feature.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, walkExpr } from "./expr.ts";
import { validate } from "./validate.ts";
import { describe } from "./describe.ts";
import { generationSchema, toGenerated, fromGenerated } from "./generate.ts";
import { KageSession } from "./session.ts";
import { expressiveExamples } from "../packs/examples.ts";
import { Store } from "../store/store.ts";
import { dispatch } from "../adapters/operations.ts";
import type { KageDoc } from "./types.ts";
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), "utf8"));

test("computation matches captured oracle results", () => {
  for (const { expr, value } of fixture("golden-computation")) assert.deepEqual(evaluate(expr, {}), value);
});

test("arithmetic errors and overflow are null, never NaN or Infinity", () => {
  for (const expr of [{ $div: [1, 0] }, { $mod: [2, 0] }, { $pow: [-2, .5] }, { $mul: [1e308, 1e308] }, { $add: ["2", 3] }, { $round: [12, 20] }, { $lt: [null, 1] }]) assert.equal(evaluate(expr, {}), null);
  assert.equal(evaluate({ $round: [1234, -2] }, {}), 1200);
  assert.equal(evaluate({ $sub: [10, 3] }, {}), 7);
  assert.equal(evaluate({ $min: [3, -2, 7] }, {}), -2);
  assert.equal(evaluate({ $max: [3, -2, 7] }, {}), 7);
});

test("sorting is stable, handles missing fields and never mutates data", () => {
  const list = [{ id: "a", n: 2 }, { id: "b", n: 1 }, { id: "c", n: 2 }, { id: "d" }];
  const before = JSON.stringify(list);
  assert.deepEqual(evaluate({ $sort: { list, field: "n", direction: "desc" } }, {}).map((x: any) => x.id), ["a", "c", "b", "d"]);
  assert.equal(JSON.stringify(list), before);
  assert.deepEqual(evaluate({ $sort: { list: null } }, {}), []);
  assert.equal(evaluate({ $format: { value: "2026-01-02T01:00:00+05:30", style: "date" } }, {}), "Jan 1, 2026");
  assert.equal(evaluate({ $format: { value: "today", style: "date" } }, {}), null);
});

for (const system of ["core", "ledger", "atelier"]) test(`expressive examples match oracle and survive generation under ${system}`, () => {
  for (const doc of expressiveExamples()) {
    const golden = fixture(`golden-${doc.id}-${system}`);
    assert.deepEqual(validate(doc, system), golden.validation);
    assert.equal(describe(doc, system), golden.description);
    assert.deepEqual(toGenerated(doc, system), golden.envelope);
    const back = fromGenerated(toGenerated(doc, system), system);
    assert.deepEqual(back.compositions, doc.compositions);
    assert.deepEqual(back.blocks.product?.repeat, doc.blocks.product?.repeat);
    assert.equal(validate(back).ok, true);
  }
  for (const v of generationSchema(system).properties.blocks.items.anyOf) assert.ok(v.required.includes("repeat_json"));
});

test("repeated compositions isolate locals, export outputs and preserve identity after filtering", () => {
  const session = new KageSession(expressiveExamples()[0]);
  const notes = Object.keys(session.instances().blocks).filter(id => id.startsWith("notes~"));
  assert.equal(notes.length, 3);
  session.dispatch(notes[0], "change", { value: "Atlas note" });
  session.dispatch(notes[1], "change", { value: "Canvas note" });
  assert.equal(session.read(notes[0])?.value, "Atlas note");
  assert.equal(session.read(notes[1])?.value, "Canvas note");
  const compositions = Object.keys(session.instances().blocks).filter(id => id.startsWith("product~"));
  assert.equal(session.read(compositions[0])?.value, "Atlas note");
  session.dispatch("search", "change", { value: "Design" });
  assert.equal(Object.keys(session.instances().blocks).filter(id => id.startsWith("notes~")).length, 1);
  session.dispatch("search", "change", { value: "" });
  assert.equal(session.read(notes[0])?.value, "Atlas note");
  assert.equal(session.read(notes[1])?.value, "Canvas note");
});

function repeated(): KageDoc {
  return { kages: "1.0", id: "repeat-test", title: "Repeat test", system: "core@1", root: "root", state: { selected: "", rows: [{ id: "a.b", label: "First", values: ["one", "two"] }, { id: "b", label: "Second", values: ["three"] }] }, blocks: {
    root: { type: "grid", slots: { children: ["row"] } },
    row: { type: "section", repeat: { each: { $state: "rows" }, key: "id", as: "row" }, bind: { title: { $item: "label" } }, slots: { children: ["input", "output", "button", "mapped", "inner"] } },
    input: { type: "text-field", props: { label: "Note" } },
    output: { type: "text", bind: { text: { $block: "input.value" } } },
    button: { type: "button", props: { label: "Choose" }, on: { click: [{ do: "set", path: "selected", value: { $item: "id" } }] } },
    mapped: { type: "list", bind: { items: { $map: { list: { $item: "values" }, to: { $item: "" } } } } },
    inner: { type: "text", repeat: { each: { $item: "values" } }, bind: { text: { $concat: [{ $scope: "row.label" }, ": ", { $item: "" }, " at ", { $index: "" }] } } },
  } };
}

test("nested repeats, scoped sibling outputs and item-aware events share the right context", () => {
  const session = new KageSession(repeated());
  const ids = Object.keys(session.instances().blocks);
  const input = ids.find(id => id.startsWith("input~"))!;
  const output = ids.find(id => id.startsWith("output~"))!;
  const button = ids.find(id => id.startsWith("button~"))!;
  session.dispatch(input, "change", { value: "Only first row" });
  assert.equal(session.read(output)?.text, "Only first row");
  session.dispatch(button, "click");
  assert.equal(session.getState().selected, "a.b");
  assert.equal(session.read(ids.find(id => id.startsWith("inner~"))!)?.text, "First: one at 0");
  assert.deepEqual(session.read(ids.find(id => id.startsWith("mapped~"))!)?.items, ["one", "two"]);
});

test("row reorder follows keys and positional keys are documented fallback", () => {
  const doc = repeated();
  doc.blocks.reorder = { type: "button", props: { label: "Reorder" }, on: { click: [{ do: "set", path: "rows", value: { $sort: { list: { $state: "rows" }, field: "id", direction: "desc" } } }] } };
  doc.blocks.root.slots!.children.push("reorder");
  const session = new KageSession(doc);
  const input = Object.keys(session.instances().blocks).find(id => id.startsWith("input~"))!;
  session.dispatch(input, "change", { value: "Remember me" });
  session.dispatch("reorder", "click");
  assert.equal(session.read(input)?.value, "Remember me");
});

test("empty collections and root repeats render a valid empty instance tree", () => {
  const doc = repeated(); doc.root = "row"; doc.state!.rows = [];
  const session = new KageSession(doc);
  assert.deepEqual(session.instances().blocks[session.instances().root].slots?.children, []);
});

test("invalid repeat keys, recursion, typed inputs and malformed formulas are rejected", () => {
  for (const rows of [[{ id: "x" }, { id: "x" }], [{ label: "missing" }]]) {
    const doc = repeated(); doc.state!.rows = rows;
    assert.equal(validate(doc).ok, false);
  }
  const doc = expressiveExamples()[0];
  doc.compositions!.product.blocks.card.slots!.children.push("loop");
  doc.compositions!.product.blocks.loop = { type: "composition", props: { name: "product", inputs: { name: "nested", category: "x", price: 1 } } };
  assert.equal(validate(doc).ok, false);
  const bad = expressiveExamples()[0];
  bad.blocks.product.bind!.inputs = { name: 42, category: "x", price: 1 };
  assert.equal(validate(bad).ok, false);
  const math = expressiveExamples()[1]; math.blocks.result.bind!.value = { $div: [1] };
  assert.ok(validate(math).errors.some(e => e.code === "bad-expr"));
});

test("item data with operator-looking keys remains literal and opaque to validation", () => {
  const doc = repeated(); doc.state!.rows = [{ id: "x", label: { $state: "selected" }, values: [] }];
  const session = new KageSession(doc);
  const row = Object.keys(session.instances().blocks).find(id => id.startsWith("row~"))!;
  assert.deepEqual(session.read(row)?.title, { $state: "selected" });
  const ops: string[] = []; walkExpr({ $literal: { $state: "selected" } }, op => ops.push(op));
  assert.deepEqual(ops, ["$literal"]);
});

test("new artifacts create and preview concrete instances through the operation table", () => {
  const store = new Store({ workspace: "test" });
  const author = { principal: "agent:builder" };
  store.grant(author.principal, "templates", ["write", "publish"]);
  const ctx = { store, author, repo: "templates" };
  for (const doc of expressiveExamples()) {
    assert.equal(dispatch(ctx, "create_kage", { doc }).ok, true);
    const preview = dispatch(ctx, "preview_kage", { name: doc.id });
    assert.equal(preview.ok, true);
    if (preview.ok && doc.id === "collection-lab") assert.ok(Object.keys((preview.data as any).blocks).some(id => id.startsWith("notes~")));
  }
  const result = store.head("collection-lab")!;
  // text-field gained the optional `error` prop (minor release 1.1.0); the lockfile pins whatever the registry resolved.
  assert.equal(result.resolved.blocks["compositions/product/notes"], "core/text-field@1.1.0");
});

test("dormant recursive definitions, undeclared inputs and private outputs are rejected", () => {
  const doc = expressiveExamples()[0];
  doc.state!.query = "no matches";
  doc.compositions!.product.blocks.card.slots!.children.push("loop");
  doc.compositions!.product.blocks.loop = { type: "composition", props: { name: "product", inputs: { name: "x", category: "x", price: 1 } } };
  assert.ok(validate(doc).errors.some(e => e.code === "composition-cycle"));
  const wrong = expressiveExamples()[0]; wrong.compositions!.product.output = { $block: "card.title" };
  assert.ok(validate(wrong).errors.some(e => e.code === "private-output"));
  const missing = expressiveExamples()[0]; missing.compositions!.product.blocks.category.bind!.text = { $input: "unknown" };
  assert.ok(validate(missing).errors.some(e => e.code === "unknown-input"));
});

test("ambiguous repeated references and bounded-slot repeats are rejected", () => {
  const doc = repeated();
  doc.blocks.global = { type: "text", bind: { text: { $block: "input.value" } } };
  doc.blocks.root.slots!.children.push("global");
  assert.ok(validate(doc).errors.some(e => e.code === "ambiguous-instance"));
  const bounded = repeated(); bounded.blocks.root = { type: "shell", slots: { sidebar: ["row"] } };
  assert.ok(validate(bounded).errors.some(e => e.code === "repeat-slot-limit"));
});

test("composition input bindings can read controls in the same repeated scope", () => {
  const doc = repeated();
  doc.compositions = { echo: { inputs: { message: { type: "string", required: true } }, root: "body", blocks: { body: { type: "text", bind: { text: { $input: "message" } } } } } };
  doc.blocks.echo = { type: "composition", props: { name: "echo" }, bind: { inputs: { message: { $block: "input.value" } } } };
  doc.blocks.row.slots!.children.push("echo");
  const session = new KageSession(doc);
  const input = Object.keys(session.instances().blocks).find(id => id.startsWith("input~"))!;
  session.dispatch(input, "change", { value: "Bound within this row" });
  const body = Object.keys(session.instances().blocks).find(id => id.startsWith("body~"))!;
  assert.equal(session.read(body)?.text, "Bound within this row");
});

test("typed composition outputs are checked, and local output snapshots cannot mutate state", () => {
  const doc = expressiveExamples()[0]; doc.compositions!.product.outputType = { type: "number" };
  assert.equal(validate(doc).ok, false);
  const session = new KageSession(expressiveExamples()[1]);
  const output = session.read("rate")!; output.value = 100;
  assert.equal(session.read("rate")?.value, 5);
});

test("expansion fails closed at the block budget", () => {
  const doc: KageDoc = { kages: "1.0", id: "bounded", title: "Bounded", system: "core@1", root: "root", data: { items: Array.from({ length: 10001 }, (_, i) => i) }, blocks: { root: { type: "text", props: { text: "Item" }, repeat: { each: { $data: "items" } } } } };
  assert.throws(() => new KageSession(doc).instances(), /10000 rendered blocks/);
});

test("invalid authoring findings match the extended oracle", () => {
  const docs = fixture("expressive-invalid.kage");
  const goldens = fixture("golden-expressive-invalid");
  docs.forEach((doc: KageDoc, i: number) => assert.deepEqual(validate(doc), goldens[i]));
});

test("strict expression props survive generation and legacy envelopes still parse", () => {
  const doc = expressiveExamples()[1];
  doc.blocks.intro.props!.title = { $tpl: "Rate {{state.rate}}" };
  const envelope = toGenerated(doc);
  const back = fromGenerated(envelope, "core");
  assert.deepEqual(back.blocks.intro.bind!.title, doc.blocks.intro.props!.title);
  assert.equal(new KageSession(back).read("intro")?.title, "Rate 5");
  delete envelope.compositions_json;
  for (const b of envelope.blocks) delete b.repeat_json;
  assert.equal(validate(fromGenerated(envelope, "core")).ok, true);
});

test("commands target only the matching repeated instance", () => {
  const doc = repeated();
  doc.blocks.input = { type: "dropdown", props: { label: "Picker", options: [{ value: "one", label: "One" }] } };
  doc.blocks.button.on!.click = [{ do: "call", target: "input", command: "clear" }];
  const session = new KageSession(doc);
  const ids = Object.keys(session.instances().blocks);
  const inputs = ids.filter(id => id.startsWith("input~"));
  for (const id of inputs) session.dispatch(id, "change", { value: "one" });
  session.dispatch(ids.find(id => id.startsWith("button~"))!, "click");
  assert.equal(session.read(inputs[0])?.value, null);
  assert.equal(session.read(inputs[1])?.value, "one");
});

test("composition definition edits respect root claims and retain signed versions", () => {
  const store = new Store({ clock: () => 1000 });
  store.grant("agent:a", "kages", ["write"]); store.grant("agent:b", "kages", ["write"]);
  store.create("kages", expressiveExamples()[0], { principal: "agent:a" });
  store.claims.claim("collection-lab", ["root"], "agent:a", 300, 1000);
  const ops = [{ op: "replace" as const, path: "/compositions/product/blocks/card/props/level", value: 4 }];
  assert.equal(store.patch("collection-lab", ops, { principal: "agent:b" }).error?.code, "claimed");
  assert.equal(store.head("collection-lab")!.v, 1);
  assert.equal(store.patch("collection-lab", ops, { principal: "agent:a" }).ok, true);
  assert.equal(store.getVersion("collection-lab", 1)!.doc.compositions!.product.blocks.card.props!.level, 3);
});

test("concurrent definition edits conflict, and disjoint block edits preserve definitions", () => {
  const store = new Store({ clock: () => 1000 });
  store.grant("agent:a", "kages", ["write"]); store.grant("agent:b", "kages", ["write"]);
  store.create("kages", expressiveExamples()[0], { principal: "agent:a" });
  assert.equal(store.patch("collection-lab", [{ op: "replace", path: "/blocks/intro/props/title", value: "Updated title" }], { principal: "agent:a" }).ok, true);
  assert.equal(store.patch("collection-lab", [{ op: "replace", path: "/compositions/product/blocks/card/props/level", value: 4 }], { principal: "agent:b" }, { baseVersion: 1 }).ok, true);
  assert.equal(store.head("collection-lab")!.doc.compositions!.product.blocks.card.props!.level, 4);
  assert.equal(store.head("collection-lab")!.doc.blocks.intro.props!.title, "Updated title");
  assert.equal(store.patch("collection-lab", [{ op: "replace", path: "/compositions/product/blocks/card/props/tone", value: "sunken" }], { principal: "agent:a" }, { baseVersion: 1 }).error?.code, "conflict");
});
