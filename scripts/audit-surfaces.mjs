// Dev aid: what browser-surface and motion gaps remain in the built bundle? Lists
// numeric component classes without tabular numerals, hidden scrollbars, removed focus
// rings and every transition in the reference stylesheet. Read-only; the enforced
// versions of these checks are in src/design-system/*.test.ts.
import { readFileSync } from "node:fs";
import { parseRules, declarationsOf, findHiddenFocus, checkMotion } from "../src/design-system/css-check.ts";

const css = readFileSync("public/ds/bundle.css", "utf8");
const rules = parseRules(css);
const tabular = new Set(rules.filter((r) => /tabular-nums/.test(r.body)).flatMap((r) => r.selector.split(",").map((s) => s.trim())));
const numeric = [...new Set([...css.matchAll(/\.((?:kg|lg|at)-[a-z0-9_-]*(?:num|count|value|time|day|price|total)[a-z0-9_-]*)/g)].map((m) => "." + m[1]))];
console.log("numeric-looking classes without tabular numerals:", numeric.filter((c) => ![...tabular].some((t) => t.includes(c))).join(" ") || "none");
console.log("reference rules that hide a scrollbar (surfaces.css overrides the tab strips):", rules.filter((r) => declarationsOf(r).some(([p, v]) => p === "scrollbar-width" && v === "none")).map((r) => r.selector).join(" | ") || "none");
console.log("removed focus rings:", findHiddenFocus(css).map((i) => i.selector).join(" | ") || "none");
console.log("transitions in the whole bundle:", rules.filter((r) => /transition|animation/.test(r.body)).map((r) => r.selector).join(" | "));
console.log("policy issues in the whole bundle (reference included):", checkMotion(css).length);
