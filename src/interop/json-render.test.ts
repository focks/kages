import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fromJsonRender, toJsonRender, checkJsonRender, type JrSpec } from "./json-render.ts";
import { validate } from "../engine/validate.ts";
import { lintDetailed } from "../engine/advice.ts";
import { KageSession } from "../engine/session.ts";
import { EXAMPLES } from "../packs/decision-guide-examples.ts";
import { buildDecisionGuide } from "../packs/decision-guide.ts";
import { outlineToKage } from "../engine/outline.ts";

const spec = JSON.parse(readFileSync(fileURLToPath(new URL("./__fixtures__/signup.jr.json", import.meta.url)), "utf8")) as JrSpec;

test("a json-render spec becomes a valid Kage, with every approximation reported", () => {
  const { value: doc, notes } = fromJsonRender(spec);
  const v = validate(doc);
  assert.deepEqual(v.errors, []);
  assert.equal(doc.root, "page");
  assert.equal(doc.blocks.h.type, "text");
  assert.equal((doc.blocks.h.props as { variant: string }).variant, "display");
  assert.deepEqual(doc.state, { form_plan: "free", form_email: "", form_agree: false, tab: "plan", seats: 5 });
  assert.equal(doc.blocks.skel, undefined, "a loading skeleton is left out and not left dangling");
  assert.ok(!doc.blocks.page.slots!.children.includes("skel"));
  const text = notes.join("\n");
  for (const re of [/sendEmail.*app-specific/, /Chart3D.*no Kages equivalent/, /Skeleton.*left out/]) assert.match(text, re);
});

test("the imported Kage works: bindings round-trip state, visibility follows it, setState becomes set", () => {
  const { value: doc } = fromJsonRender(spec), s = new KageSession(doc);
  assert.ok(!s.visible("go") && s.visible("oops"));
  s.dispatch("agree", "change", { checked: true });
  assert.ok(s.visible("go") && !s.visible("oops"));
  assert.equal(s.getState().form_agree, true);
  s.dispatch("plan", "change", { value: "team" });
  assert.equal(s.getState().form_plan, "team");
  s.dispatch("go", "click");
  assert.equal(s.getState().tab, "done");
  assert.equal(s.read("total")?.text, "You picked team for 5 seats");
});

test("refuses what is not a spec", () => {
  assert.throws(() => fromJsonRender({} as JrSpec), /not a json-render spec/);
  assert.throws(() => fromJsonRender({ root: "x", elements: { y: { type: "Text" } } }), /root "x"/);
});

test("every decision guide exports to a structurally valid json-render spec, and says what it could not carry", () => {
  for (const [name, intake] of Object.entries(EXAMPLES)) {
    const { value, notes } = toJsonRender(buildDecisionGuide(intake).doc!);
    assert.deepEqual(checkJsonRender(value), [], name);
    assert.ok(value.state && "step" in value.state);
    assert.ok(notes.some((n) => /computed value was frozen/.test(n)), name);
  }
});

test("export keeps bindings, visibility and simple actions in json-render's own forms", () => {
  const { value } = toJsonRender(buildDecisionGuide(EXAMPLES["queue-choice"]).doc!);
  const q = value.elements["q-replay"];
  assert.equal(q.type, "Radio");
  assert.deepEqual(q.props!.value, { $bindState: "/replay" });
  assert.deepEqual(q.props!.options, ["No, each message is processed once", "Yes, replay or fan-out matters"]);
  assert.deepEqual(value.elements["rec-0"].visible, { $and: [{ $state: "/replay", eq: "no" }, { $state: "/team", eq: "no" }] });
  assert.equal(value.elements["in-messages"].type, "Slider");
  assert.deepEqual(value.elements["in-messages"].props!.value, { $bindState: "/messages" });
  assert.equal(value.elements["code-decide"].visible && (value.elements["code-decide"].visible as { eq: string }).eq, "decide");
});

test("a button's set handler exports as setState and imports back", () => {
  const doc = { kages: "1.0", id: "b", title: "B", system: "core@1", root: "root", state: { n: 0 }, blocks: { root: { type: "page", props: {}, slots: { children: ["b"] } }, b: { type: "button", props: { label: "Go" }, on: { click: [{ do: "set", path: "n", value: 1 }, { do: "call", target: "x", command: "y" }] } } } } as never;
  const { value, notes } = toJsonRender(doc);
  assert.deepEqual(value.elements.b.on, { press: { action: "setState", params: { statePath: "/n", value: 1 } } });
  assert.match(notes.join("\n"), /"call" handler.*left out/);
  const back = fromJsonRender(value).value;
  assert.deepEqual((back.blocks.b as { on: unknown }).on, { click: [{ do: "set", path: "n", value: 1 }] });
});

test("a document from markdown also exports cleanly; unsupported blocks are reported not hidden", () => {
  const md = outlineToKage("# Title\n\nSome text.\n\n## One\n\ntext\n\n## Two\n\ntext\n\n## Three\n\ntext\n", {}).doc;
  const { value, notes } = toJsonRender(md);
  assert.deepEqual(checkJsonRender(value), []);
  assert.match(notes.join("\n"), /toc has no json-render equivalent/);
  assert.deepEqual(lintDetailed(fromJsonRender(spec).value, { system: "core" }).findings.filter((f) => f.severity === "P0"), []);
});

test("checkJsonRender catches what would break a renderer", () => {
  const bad = checkJsonRender({ root: "a", elements: { a: { type: "Stack", children: ["b", "gone"] }, b: { type: "Heading", props: {} }, c: { type: "Nope", props: {} }, d: { type: "Text", props: { text: "x" }, children: ["b"] } } }).join("\n");
  for (const re of [/"gone" does not exist/, /Heading needs "text"/, /"Nope" is not a component/, /c: is not reachable/]) assert.match(bad, re);
});
