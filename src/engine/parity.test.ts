// Operators and handlers beyond the reference: floor/ceil/abs, join/truncate, compact and relative
// $format, a computed action path (a row writes to list.<index>.field), and `watch`. Each is checked in the pure
// engine and against the served oracle bundle so a formula reads the same on the server and in the browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { evaluate } from "./expr.ts";
import { validate } from "./validate.ts";
import { KageSession } from "./session.ts";
import type { KageDoc } from "./types.ts";

const window: any = { React };
runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl, document: {} });
const oracle = window.Kages;

const CASES: [unknown, unknown][] = [
  [{ $floor: [2.9] }, 2], [{ $floor: [-2.1] }, -3], [{ $ceil: [2.1] }, 3], [{ $abs: [-4.5] }, 4.5], [{ $floor: ["2"] }, null], [{ $abs: [1, 2] }, null],
  [{ $join: { list: ["a", 2, null, "c"], separator: "-" } }, "a-2--c"], [{ $join: { list: ["x", "y"] } }, "x, y"], [{ $join: { list: "nope" } }, ""],
  [{ $truncate: { value: "Trunk-based", length: 5 } }, "Trunk..."], [{ $truncate: { value: "short", length: 10, suffix: "…" } }, "short"], [{ $truncate: { value: 12345, length: 2, suffix: "" } }, "12"],
  [{ $format: { value: 1234567, style: "number", notation: "compact" } }, "1.2M"],
  [{ $format: { value: "2026-10-13T00:00:00Z", style: "relative", relativeTo: "2026-10-16T00:00:00Z" } }, "3d ago"],
  [{ $format: { value: "2026-10-16T05:00:00Z", style: "relative", relativeTo: "2026-10-16T00:00:00Z" } }, "5h from now"],
  [{ $format: { value: "2026-10-16T00:00:00Z", style: "relative", relativeTo: "2026-10-16T00:00:00Z" } }, "just now"],
  [{ $format: { value: "yesterday", style: "relative", relativeTo: "2026-10-16T00:00:00Z" } }, null],
  [{ $format: { value: "2026-10-13T00:00:00Z", style: "relative" } }, null],
];

test("the new operators agree in the pure engine and the oracle bundle", () => {
  for (const [expr, want] of CASES) {
    assert.deepEqual(evaluate(expr as never, {}), want, "engine " + JSON.stringify(expr));
    assert.deepEqual(oracle.evaluate(expr, {}), want, "oracle " + JSON.stringify(expr));
  }
});

test("malformed arguments are refused by validation, not guessed at", () => {
  const doc = (text: unknown): KageDoc => ({ kages: "1.0", id: "x", title: "x", system: "core@1", root: "t", blocks: { t: { type: "text", props: {}, bind: { text: text as never } } } });
  for (const bad of [{ $join: "x" }, { $join: { list: [], separator: 5 } }, { $truncate: { length: 3 } }, { $truncate: { value: "a", length: -1 } }, { $floor: 2 }, { $format: { value: 1, style: "relative", relativeTo: 5 } }, { $format: { value: 1, style: "number", notation: "scientific" } }])
    assert.ok(validate(doc(bad)).errors.length > 0, JSON.stringify(bad));
  assert.deepEqual(validate(doc({ $join: { list: [1], separator: "/" } })).errors, []);
});

const listDoc = (): KageDoc => ({
  kages: "1.0", id: "rows", title: "Rows", system: "core@1", root: "page",
  state: { todos: [{ id: "a", done: false }, { id: "b", done: false }], changes: 0, copy: 0 },
  blocks: {
    page: { type: "stack", props: {}, slots: { children: ["row"] } },
    row: { type: "stack", props: {}, repeat: { each: { $state: "todos" }, key: "id" }, slots: { children: ["box"] } },
    box: { type: "checkbox", props: { label: "Done" }, bind: { checked: { $item: "done" } },
      on: { change: [{ do: "set", path: { $concat: ["todos.", { $index: "" }, ".done"] }, value: { $event: "checked" } }] } },
    counter: { type: "text", props: { text: "x" }, watch: { todos: [{ do: "set", path: "changes", value: { $add: [{ $state: "changes" }, 1] } }] } },
  },
});

test("a repeated row writes to its own element, and watch fires once per changed path", () => {
  const doc = listDoc(); (doc.blocks.page.slots as any).children.push("counter");
  assert.deepEqual(validate(doc).errors, []);
  const s = new KageSession(doc), boxes = Object.entries(s.instances().blocks).filter(([, b]) => b.type === "checkbox").map(([id]) => id);
  s.dispatch(boxes[1], "change", { checked: true });
  assert.deepEqual((s.getState().todos as any[]).map((t) => t.done), [false, true]);
  assert.equal(s.getState().changes, 1, "the watcher ran after the write");
  s.dispatch(boxes[1], "change", { checked: true });
  assert.equal(s.getState().changes, 1, "an equal write is not a change");
});

test("a path that is not a state path writes nothing and says so", () => {
  const doc = listDoc();
  doc.blocks.box.on = { change: [{ do: "set", path: { $add: [1, 2] } as never, value: 1 }] };
  const s = new KageSession(doc), id = Object.keys(s.instances().blocks).find((k) => k.startsWith("box"))!;
  const before = JSON.stringify(s.getState());
  const log = s.dispatch(id, "change", { checked: true });
  assert.equal(JSON.stringify(s.getState()), before);
  assert.ok(log.some((l) => /not a state path/.test(l.msg)), JSON.stringify(log));
  assert.equal(validate({ ...listDoc(), blocks: { ...listDoc().blocks, box: { ...listDoc().blocks.box, on: { change: [{ do: "set", path: 5 as never, value: 1 }] } } } }).errors.some((e) => e.code === "bad-path"), true);
  const proto = listDoc(); proto.blocks.box.on = { change: [{ do: "set", path: { $concat: ["__proto__", ".x"] } as never, value: 1 }] };
  const p = new KageSession(proto); p.dispatch(Object.keys(p.instances().blocks).find((k) => k.startsWith("box"))!, "change", { checked: true });
  assert.equal(({} as any).x, undefined);
});

test("watch handlers that keep changing what they watch stop, and are reported", () => {
  const doc: KageDoc = { kages: "1.0", id: "loop", title: "Loop", system: "core@1", root: "page", state: { n: 0 }, blocks: {
    page: { type: "stack", props: {}, slots: { children: ["btn", "w"] } },
    btn: { type: "button", props: { label: "Go" }, on: { click: [{ do: "set", path: "n", value: 1 }] } },
    w: { type: "text", props: { text: "w" }, watch: { n: [{ do: "set", path: "n", value: { $add: [{ $state: "n" }, 1] } }] } },
  } };
  const s = new KageSession(doc), log = s.dispatch("btn", "click");
  assert.equal(s.getState().n, 5, "one click plus four passes");
  assert.ok(log.some((l) => /keep changing what they watch/.test(l.msg)));
  assert.ok(validate({ ...doc, blocks: { ...doc.blocks, w: { ...doc.blocks.w, watch: { n: "nope" as never } } } }).errors.some((e) => e.code === "bad-watch"));
  assert.ok(validate({ ...doc, blocks: { ...doc.blocks, w: { ...doc.blocks.w, watch: { ghost: [{ do: "log", message: "x" }] } } } }).warnings.some((e) => e.code === "undeclared-state"));
});
