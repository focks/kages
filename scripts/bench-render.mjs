// Render and expansion cost, so a change that slows large pages shows up as a number. Run with the production build of
// React to match what users get:  NODE_ENV=production node scripts/bench-render.mjs
// It prints the slowest shipped examples, then a synthetic list of N repeated cards (each with a templated line) and a
// table of N rows. Nothing here is a pass/fail gate (see src/design-system/lists.test.ts for the scaling guard).
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { freeFlowExamples, expressiveExamples, richExamples, appExamples, connectedExamples, chartExamples, contentExamples } from "../src/packs/examples.ts";
import { KageSession } from "../src/engine/session.ts";

const req = createRequire(new URL("../package.json", import.meta.url));
const React = req("react"), { renderToStaticMarkup } = req("react-dom/server");
const window = { React };
runInNewContext(readFileSync(new URL("../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl, document: {} });
const render = (doc) => renderToStaticMarkup(React.createElement(window.Kages.KageRenderer, { doc }));
const time = (f, n = 5) => { f(); const a = performance.now(); for (let i = 0; i < n; i++) f(); return (performance.now() - a) / n; };

const examples = [...freeFlowExamples(), ...expressiveExamples(), ...richExamples(), ...appExamples(), ...connectedExamples(), ...chartExamples(), ...contentExamples()];
console.log(`React ${process.env.NODE_ENV === "production" ? "production" : "development"} build; milliseconds per render\n\nslowest shipped examples:`);
for (const [id, blocks, ms] of examples.map((d) => [d.id, Object.keys(d.blocks).length, time(() => render(d))]).sort((a, b) => b[2] - a[2]).slice(0, 6)) console.log(`  ${id.padEnd(24)} ${String(blocks).padStart(3)} blocks  ${ms.toFixed(1).padStart(6)} ms`);

const big = (n) => ({ kages: "1.0", id: "big", title: "Big", system: "core@1", root: "page", state: { q: "" }, data: { items: Array.from({ length: n }, (_, i) => ({ id: "r" + i, name: "Item " + i, price: i, tag: "t" + (i % 7) })) }, blocks: {
  page: { type: "stack", props: {}, slots: { children: ["search", "list", "tbl"] } },
  search: { type: "text-field", props: { label: "q" }, bind: { value: { $state: "q" } }, on: { change: [{ do: "set", path: "q", value: { $event: "value" } }] } },
  list: { type: "card", props: {}, repeat: { each: { $data: "items" }, key: "id" }, bind: { title: { $item: "name" } }, slots: { children: ["price"] } },
  price: { type: "text", props: {}, bind: { text: { $tpl: "${{item.price}} {{item.tag}}" } } },
  tbl: { type: "table", props: { columns: [{ key: "name", label: "Name" }, { key: "price", label: "Price" }] }, bind: { rows: { $data: "items" } } } } });
console.log("\nsynthetic list + table (rows each):");
for (const n of [100, 500, 2000]) {
  const d = big(n), s = new KageSession(d);
  console.log(`  ${String(n).padStart(5)} rows  render ${time(() => render(d), 3).toFixed(0).padStart(4)} ms   expand ${time(() => { s.expanded = undefined; s.context = undefined; s.instances(); }, 3).toFixed(0).padStart(3)} ms   one keystroke ${time(() => s.dispatch("search", "change", { value: "x" + Math.random() }), 3).toFixed(0).padStart(3)} ms`);
}
