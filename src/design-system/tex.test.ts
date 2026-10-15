// The TeX engine is rendered from the served bundle. Structural tests pin that
// each construct becomes the right elements; the safety tests pin that nothing
// but text ever reaches the page and that crafted input cannot hang the render.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const window: any = { React };
runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl, document: {} });
const math = (tex: string, display = false) => renderToStaticMarkup(React.createElement(window.Kages.CoreMath, { tex, display, label: "m" }));
const count = (html: string, re: RegExp) => (html.match(re) || []).length;

test("scripts: side scripts stack both sup and sub; limits stack only in display mode", () => {
  assert.match(math("x^2"), /<sup>/); assert.match(math("x_i"), /<sub>/);
  assert.match(math("x_i^2"), /kg-math__ss/);
  const inline = math("\\sum_{i=1}^{n} i"), display = math("\\sum_{i=1}^{n} i", true);
  assert.doesNotMatch(inline, /kg-math__limits/); assert.match(display, /kg-math__limits/);
  assert.match(display, /kg-math__over/); assert.match(display, /kg-math__under/);
  assert.match(math("\\lim_{x\\to 0} f", true), /kg-math__limits/);
  assert.doesNotMatch(math("\\int_0^1 x", true), /kg-math__limits/, "integrals keep side scripts");
  assert.match(math("f'"), /′/);
});

test("fractions, binomials and roots", () => {
  assert.match(math("\\frac{a}{b+1}"), /kg-math__num/);
  const binom = math("\\binom{n}{k}"); assert.match(binom, /kg-math__fenced/); assert.match(binom, /frac--nobar/);
  const root = math("\\sqrt[3]{x}"); assert.match(root, /kg-math__rootidx/); assert.match(root, />3</);
  assert.match(math("\\frac{\\frac{1}{2}}{3}"), /kg-math__den/);
});

test("\\left...\\right become stretchy SVG fences and never leak the command names", () => {
  const html = math("\\left(\\frac{a}{b}\\right)^{2} \\left\\{ x \\right.");
  assert.equal(count(html, /<svg/g), 3, "two fences for the first pair, one for the open brace; \\right. draws nothing");
  assert.match(html, /preserveAspectRatio="none"/); assert.doesNotMatch(html, /left|right|\\\\/);
  assert.match(math("\\left\\langle x \\right\\rangle"), /M8 0L2 50L8 100/);
});

test("matrices, cases and aligned environments produce grids with the right shape", () => {
  const m = math("\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", true);
  assert.equal(count(m, /kg-math__cell"/g), 4); assert.match(m, /repeat\(2, auto\)/); assert.equal(count(m, /<svg/g), 2);
  const cases = math("f(x) = \\begin{cases} 1 & x > 0 \\\\ 0 & \\text{otherwise} \\end{cases}", true);
  assert.match(cases, /matrix--cases/); assert.equal(count(cases, /<svg/g), 1); assert.match(cases, /otherwise/);
  const al = math("\\begin{aligned} a &= b \\\\ c &= d \\end{aligned}", true);
  assert.match(al, /cell--r/); assert.match(al, /cell--l/); assert.equal(count(al, /<svg/g), 0);
  assert.equal(count(math("\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}"), /<svg/g), 2);
  assert.equal(count(math("\\begin{bmatrix} 1 \\\\ 2 \\\\ \\end{bmatrix}"), /kg-math__cell"/g), 2, "a trailing row break adds no empty row");
});

test("text, fonts, accents, spacing and symbols", () => {
  assert.match(math("\\text{ for all } x"), /kg-math__text/);
  assert.match(math("\\mathbb{R}"), /ℝ/); assert.match(math("\\mathcal{L}"), /ℒ/); assert.match(math("\\mathbb{N} \\mathfrak{g}"), /ℕ/);
  assert.match(math("\\mathbf{v}"), /kg-math__bf/); assert.match(math("\\mathrm{d}x"), /kg-math__rm/);
  for (const a of ["hat", "vec", "bar", "tilde", "dot", "overline"]) assert.match(math("\\" + a + "{x}"), new RegExp("accent--" + a));
  assert.match(math("a\\,b\\quad c"), /width:0\.17em/); assert.match(math("a\\quad b"), /width:1em/);
  assert.match(math("\\alpha\\beta\\Gamma\\infty\\leq\\neq\\forall\\in\\to"), /α.*β.*Γ.*∞.*≤.*≠.*∀.*∈.*→/s);
  assert.match(math("\\sin x \\log y"), /kg-math__op">sin/);
  assert.match(math("a - b"), /−/);
});

test("hostile and malformed input only ever becomes text and never throws", () => {
  const evil = math("\\evil{<script>alert(1)</script>} <img src=x onerror=alert(1)> \\href{javascript:alert(1)}{x} \\unknown } { ^ _ \\begin{nope} \\end \\left( \\right", true);
  assert.doesNotMatch(evil, /<script|<img|javascript:|onerror/i);
  assert.match(evil, /&lt;/); assert.match(evil, /unknown/);
  assert.match(math("a } b } c"), /kg-math__var">c/, "a stray closer does not truncate the formula");
  for (const bad of ["", "{", "}", "^", "_", "\\", "\\frac", "\\frac{", "\\left", "\\begin", "\\begin{pmatrix}", "x^^^^2", "\\sqrt[", "&&&&", "\\\\\\\\"]) assert.doesNotThrow(() => math(bad, true), bad);
});

test("resource bounds: depth, length and matrix size cannot hang the renderer", () => {
  const t0 = Date.now();
  math("{".repeat(5000) + "x" + "}".repeat(5000), true);
  math("\\frac{".repeat(300) + "x" + "}{1}".repeat(300), true);
  math("x^".repeat(1500), true);
  const wide = math("\\begin{matrix}" + "a & ".repeat(100) + "\\end{matrix}", true);
  assert.ok(count(wide, /kg-math__cell"/g) <= 20, "columns are capped");
  const tall = math("\\begin{matrix}" + "a \\\\ ".repeat(500) + "\\end{matrix}", true);
  assert.ok(count(tall, /kg-math__cell"/g) <= 50, "rows are capped");
  assert.ok(Date.now() - t0 < 3000, "pathological input renders quickly");
  assert.doesNotMatch(math("a".repeat(10000)), /a{2001}/, "input is length-capped");
});

test("accessibility: math exposes role, label and the source as the default label", () => {
  assert.match(math("x^2"), /role="math"/); assert.match(math("x^2"), /aria-label="m"/);
  assert.match(renderToStaticMarkup(React.createElement(window.Kages.CoreMath, { tex: "E=mc^2" })), /aria-label="E=mc\^2"/);
});
