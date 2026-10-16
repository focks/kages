import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseRules, declarationsOf, findHiddenFocus } from "./css-check.ts";
import { contrast } from "./contrast.ts";
import tokens from "../../public/ds/tokens.json" with { type: "json" };

const dir = fileURLToPath(new URL("./", import.meta.url));
const surfaces = readFileSync(dir + "surfaces.css", "utf8");
const built = readFileSync(fileURLToPath(new URL("../../public/ds/bundle.css", import.meta.url)), "utf8");
const tokensCss = readFileSync(fileURLToPath(new URL("../../public/ds/tokens.css", import.meta.url)), "utf8");

test("the surfaces exist in the built bundle: selection, caret, placeholder, markers, underline offset, forced colours", () => {
  for (const re of [/::selection/, /caret-color: var\(--kg-accent\)/, /accent-color: var\(--kg-accent\)/, /::placeholder/, /li::marker/, /text-underline-offset/, /@media \(forced-colors: active\)/]) assert.match(built, re);
});

test("every surface rule is scoped to the Kage or a Kage component; nothing reaches :root, html, body or *", () => {
  for (const r of parseRules(surfaces)) {
    for (const sel of r.selector.split(",").map((s) => s.trim())) {
      assert.match(sel, /^(:where\(\.kg-kage|\.kg-kage|\.kg-|\.lg-|\.at-)/, `unscoped selector: ${sel}`);
      assert.doesNotMatch(sel, /(^|[\s>+~(])(:root|html|body|\*)([\s>+~{:,)]|$)/, `reaches the host page: ${sel}`);
    }
  }
});

test("the tab strips no longer hide their scrollbars, and the override comes after the reference rules", () => {
  const rules = parseRules(built);
  for (const cls of [".kg-tabs", ".lg-tabs", ".at-tabs"]) {
    const withScroll = rules.filter((r) => r.selector.split(",").map((s) => s.trim()).includes(cls) && declarationsOf(r).some(([p]) => p === "scrollbar-width"));
    assert.ok(withScroll.length >= 2, `${cls}: expected the reference rule and our override`);
    assert.equal(declarationsOf(withScroll.at(-1)!).find(([p]) => p === "scrollbar-width")![1], "thin", `${cls}: the final value must be thin`);
  }
});

test("numerals that must align are tabular", () => {
  const rule = parseRules(built).filter((r) => /font-variant-numeric: tabular-nums/.test(r.body) && /kg-stepper__num/.test(r.selector));
  assert.equal(rule.length, 1);
  for (const c of ["kg-kanban__count", "kg-calendar__day", "kg-timeline__time", "kg-grid-data__num", "kg-tab__count", "lg-tab__count", "at-tab__count", "lg-side__count"]) assert.match(rule[0].selector, new RegExp(c));
});

test("nothing removes a focus ring without replacing it", () => {
  assert.deepEqual(findHiddenFocus(built), []);
  assert.match(built, /:focus-visible \{ outline: 2px solid var\(--kg-focus\)/);
});

test("color-scheme follows the theme: light on the Kage, dark under .dark, emitted by the token generator", () => {
  assert.match(tokensCss, /\.kg-kage \{\n  color-scheme: light;/);
  assert.match(tokensCss, /\.dark \.kg-kage \{\n  color-scheme: dark;/);
});

// Blend the translucent selection over each ground in sRGB, then check the TEXT that sits on it.
const hex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const blend = (fg: string, bg: string, a: number) => hex(rgb(fg).map((v, i) => v * a + rgb(bg)[i] * (1 - a)));

test("selected text stays readable in every system, theme and ground (selection is 22% accent)", () => {
  const T = tokens.color.tokens as { name: string; value: Record<string, string> }[];
  const get = (sys: string, role: string, th: string) => T.find((t) => t.name === (sys === "core" ? "" : sys + "-") + role)!.value[th];
  assert.match(surfaces, /color-mix\(in srgb, var\(--kg-accent\) 22%, transparent\)/);
  for (const sys of ["core", "ledger", "atelier"]) for (const th of ["light", "dark"]) for (const ground of ["paper", "surface", "sunken", "accent-soft"]) {
    const selected = blend(get(sys, "accent", th), get(sys, ground, th), 0.22);
    for (const text of ["ink", "ink-muted"]) {
      const ratio = contrast(get(sys, text, th), selected);
      assert.ok(ratio >= (text === "ink" ? 4.5 : 3), `${sys} ${th}: ${text} on selected ${ground} is ${ratio.toFixed(2)}`);
    }
  }
});
