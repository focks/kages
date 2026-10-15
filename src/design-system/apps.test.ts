// Batch 2 rich roles against the served bundle: safe rendering of hostile
// strings, ARIA semantics, and public state through the headless session.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { appExamples } from "../packs/examples.ts";
import { KageSession } from "../engine/session.ts";
const window: any = { React };
runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl, document: {} });
const K = window.Kages;
const render = (name: string, props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(K[name], props));

test("app examples render in every system with the expected structure", () => {
  for (const system of ["core", "ledger", "atelier"]) for (const doc of appExamples(system)) {
    const html = renderToStaticMarkup(React.createElement(K.KageRenderer, { doc }));
    assert.doesNotMatch(html, /kg-missing|NaN|Infinity|undefined/, doc.id + " " + system);
    if (doc.id === "team-workbench") for (const part of ["role=\"combobox\"", "role=\"switch\"", "kg-kanban", "kg-grid-data", "kg-calendar", "role=\"tree\""]) assert.match(html, new RegExp(part));
    if (doc.id === "math-notes") for (const part of ["kg-markdown", "kg-math", "kg-carousel", "<blockquote", "<pre"]) assert.match(html, new RegExp(part));
  }
});

test("markdown and math never produce raw HTML or unsafe links", () => {
  const html = render("CoreMarkdown", { text: "# <script>alert(1)</script>\n\n<img src=x onerror=alert(1)> [bad](javascript:alert(1)) [ok](https://example.com/a) **<b>x</b>**\n\n```\n<script>x</script>\n```" });
  assert.doesNotMatch(html, /<script|<img|<b>|javascript:/);
  assert.match(html, /&lt;script&gt;/); assert.match(html, /href="https:\/\/example.com\/a"/); assert.match(html, /bad/);
  const math = render("CoreMath", { tex: "\\frac{a}{b} + x^{2} + \\sqrt{y} + \\alpha + \\evil{<img>}", display: true });
  assert.match(math, /kg-math__frac/); assert.match(math, /<sup>/); assert.match(math, /α/); assert.doesNotMatch(math, /<img/);
  const left = render("CoreMath", { label: "growth", tex: "P\\left(1+\\frac{r}{n}\\right)^{nt}" });
  assert.doesNotMatch(left, /left|right/); assert.match(left, /<sup>/);
  const deep = render("CoreMath", { tex: "{".repeat(5000) + "}".repeat(5000) + "^".repeat(3000) });
  assert.doesNotMatch(deep, /undefined|NaN/);
  assert.match(render("CoreMarkdown", { text: "$$\nE = mc^2\n$$\n\nInline $x_1$." }), /kg-math--display/);
});

test("data grid sorts, filters and renders cells as text", () => {
  const html = render("CoreDataGrid", { label: "G", pageSize: 2, filterable: true, columns: [{ key: "n", label: "N" }, { key: "x", label: "X" }], rows: [{ n: "<i>a</i>", x: 3 }, { n: "b", x: 1 }, { n: "c", x: { k: 1 } }] });
  assert.match(html, /aria-sort="none"/); assert.match(html, /&lt;i&gt;a/); assert.doesNotMatch(html, /<i>/);
  assert.match(html, /Page 1 of 2/); assert.match(html, /tabindex="0"/); assert.match(html, /type="search"/);
  assert.match(render("CoreDataGrid", { label: "G", columns: [], rows: [null, 5] }), /No rows/);
});

test("kanban, calendar, tree, combobox and carousel are accessible and bounded", () => {
  const board = render("CoreKanban", { label: "B", columns: [{ id: "a", title: "A" }, { id: "b", title: "B" }], cards: [{ id: "1", title: "<u>t</u>", column: "a" }, { id: "2", title: "x", column: "ghost" }] });
  assert.match(board, /aria-label="Move &lt;u&gt;t&lt;\/u&gt; to B"/); assert.doesNotMatch(board, /<u>/);
  assert.match(render("CoreCalendar", { label: "C", month: "nope" }), /Calendar month must look like/);
  const cal = render("CoreCalendar", { label: "C", month: "2026-02", events: [{ date: "2026-02-14", title: "Party" }], value: "2026-02-14" });
  assert.match(cal, /February 2026/); assert.match(cal, /aria-pressed="true"/); assert.match(cal, /2026-02-14, 1 events: Party/);
  assert.equal((cal.match(/kg-calendar__day"/g) || []).length + (cal.match(/kg-calendar__day /g) || []).length, 28);
  const tree = render("CoreTree", { label: "T", expandAll: true, value: "b", nodes: [{ id: "a", label: "A", children: [{ id: "b", label: "B" }] }, { id: "c" }] });
  assert.match(tree, /aria-expanded="true"/); assert.match(tree, /aria-selected="true"/); assert.match(tree, /role="group"/);
  assert.match(render("CoreTree", { label: "T", nodes: [] }), /Nothing to show/);
  const combo = render("CoreCombobox", { label: "Who", value: "x", options: [{ value: "x", label: "Xena" }, { value: "y", label: "Yan" }] });
  assert.match(combo, /role="combobox"/); assert.match(combo, /value="Xena"/); assert.match(combo, /aria-expanded="false"/);
  const car = render("CoreCarousel", { label: "S", index: 99, slides: [{ title: "One" }, { title: "Two", src: "javascript:alert(1)" }] });
  assert.match(car, /2 of 2/); assert.doesNotMatch(car, /javascript:/); assert.match(car, /aria-roledescription="carousel"/);
  assert.match(render("CoreSwitch", { label: "L", checked: true }), /aria-checked="true"/);
});

test("work-app blocks expose public state through the session without wiring", () => {
  const session = new KageSession(appExamples()[0]);
  session.dispatch("owner", "change", { value: "ada" });
  assert.equal(session.getState().owner, "ada");
  session.dispatch("notify", "change", { checked: false });
  assert.equal(session.getState().notify, false);
  session.dispatch("board", "move", { id: "c1", from: "todo", to: "doing", cards: [{ id: "c1", title: "Draft contracts", column: "doing" }] });
  assert.deepEqual((session.read("board")?.board as any)[0], { id: "c1", title: "Draft contracts", column: "doing" });
  session.dispatch("roster", "select", { row: { name: "Ada" }, index: 0 });
  assert.deepEqual(session.read("roster")?.selected, { name: "Ada" });
  session.dispatch("schedule", "change", { value: "2026-03-04" });
  assert.equal(session.read("schedule")?.value, "2026-03-04");
  session.dispatch("areas", "select", { id: "engine" });
  assert.equal(session.read("areas")?.value, "engine");
  const notes = new KageSession(appExamples()[1]);
  notes.dispatch("slides", "change", { index: 2 });
  assert.equal(notes.read("slides")?.index, 2);
});
