import fs from "node:fs";
import vm from "node:vm";
import { referenceBundle, referenceFile } from "./ds-source.mjs";
import { freeFlowExamples, expressiveExamples } from "../src/packs/examples.ts";
const code = referenceBundle();
const noop = () => null;
const React = { createElement: noop, cloneElement: noop, createContext: () => ({ Provider: noop, Consumer: noop }),
  Fragment: "Fragment", memo: (f) => f, forwardRef: (f) => f, useState: (v) => [typeof v === "function" ? v() : v, noop],
  useRef: (v) => ({ current: v }), useMemo: (f) => f(), useEffect: noop, useLayoutEffect: noop, useCallback: (f) => f,
  useContext: () => ({}), useReducer: (r, v) => [v, noop], useId: () => "id" };
const win = { React };
const sandbox = { window: win, self: win, React, console, document: { createElement: () => ({}) } };
sandbox.globalThis = sandbox; vm.createContext(sandbox); vm.runInContext(code, sandbox, { filename: "bundle.js" });
const K = win.Kages;
const ops = JSON.parse(referenceFile("project/assets/Schemas/ops-console.kage.json"));
const BAD = { kages: "1.0", system: "ledger@2", state: { tab: "a" }, root: "app", blocks: {
  app: { type: "shell", slots: { sidebar: ["nav", "nav2"], main: ["kpi", "picker", "chart"] } },
  nav: { type: "sidebar", props: { title: "Ops" } },
  nav2: { type: "sidebar", props: { items: [{ id: "x", label: "X" }] } },
  kpi: { type: "stat", props: { label: "Rows" }, bind: { value: { $block: "nav.items" } } },
  picker: { type: "dropdown", props: { label: "Week", options: [1,2,3,4,5,6,7].map((n)=>({ value: "w"+n, label: "W"+n })) }, on: { hover: [], change: [{ do: "call", target: "nav", command: "open" }] } },
  chart: { type: "chart", props: {} } } };
fs.writeFileSync("src/engine/__fixtures__/broken.kage.json", JSON.stringify(BAD, null, 2) + "\n");
const w = (n, v) => fs.writeFileSync(`src/engine/__fixtures__/${n}.json`, JSON.stringify(v, null, 2) + "\n");
w("golden-validate-broken", K.validate(BAD));
w("golden-validate-ops-core", K.validate(ops, "core"));
w("golden-validate-ops-ledger", K.validate(ops, "ledger"));
w("golden-validate-ops-atelier", K.validate(ops, "atelier"));
w("golden-describe-ops", K.describe(ops));
w("golden-catalog-core", K.catalog("core"));
const env = K.toGenerated(ops);
w("golden-togenerated-ops", env);
const back = K.fromGenerated(env, "core");
w("golden-fromgenerated-validate", K.validate(back, "core"));
// Capture the new shapes against the extended oracle before the pure engine
// exercises them, including full generation round trips.
for (const doc of [...freeFlowExamples(), ...expressiveExamples()]) {
  fs.writeFileSync(`public/ds/${doc.id}.kage.json`, JSON.stringify(doc, null, 2) + "\n");
  for (const sys of ["core", "ledger", "atelier"]) {
    w(`golden-${doc.id}-${sys}`, { validation: K.validate(doc, sys), description: K.describe(doc, sys), envelope: K.toGenerated(doc, sys) });
  }
}
w("golden-computation", [
  ["$add", [2, 3]], ["$div", [1, 0]], ["$pow", [2, 8]], ["$round", [12.345, 2]],
  ["$gte", [7, 7]], ["$format", {value: 12.5, style: "currency"}],
  ["$sort", {list: [{n: 2}, {n: 1}, {n: 2}], field: "n"}]
].map(([op, arg]) => ({expr: {[op]: arg}, value: K.evaluate({[op]: arg}, {})})));
w("golden-expressive-invalid", JSON.parse(fs.readFileSync("src/engine/__fixtures__/expressive-invalid.kage.json", "utf8")).map(doc => K.validate(doc)));
// summary
const vb = K.validate(BAD);
console.log("broken:", vb.errors.length, "errors,", vb.warnings.length, "warnings; codes:", vb.errors.map(e=>e.code).join(","), "|", vb.warnings.map(e=>e.code).join(","));
for (const s of ["core","ledger","atelier"]) { const v = K.validate(ops, s); console.log(`ops ${s}:`, v.errors.length, "e", v.warnings.length, "w portable:", v.portable); }
const rt = K.validate(back, "core"); console.log("round-trip:", rt.errors.length, "e", rt.warnings.length, "w");
console.log("catalog core:", K.catalog("core").length, "characters");
console.log("describe type:", typeof K.describe(ops), (K.describe(ops)+"").slice(0,80).replace(/\n/g," "));
