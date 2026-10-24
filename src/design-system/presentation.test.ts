// Render the served oracle and check the palette maths: accepted props must
// produce visible differences, and a new implementation must not replace a pin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PRESENTATION_PALETTES } from "./presentation.ts";
import { designContrast } from "../engine/design.ts";
import { contrast } from "./contrast.ts";
import { validate } from "../engine/validate.ts";
import { resolve } from "../engine/resolve.ts";
import { KageSession } from "../engine/session.ts";
import { showcaseExamples } from "../packs/showcase-examples.ts";
import type { KageDoc } from "../engine/types.ts";

const window: any = { React };
runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console });
const K = window.Kages;
const render = (ref: string, props: object) => renderToStaticMarkup(React.createElement(K.implementation(ref), props));

test("region palettes keep body, links, controls and diagram categories readable in both themes", () => {
  for (const [id, palette] of Object.entries(PRESENTATION_PALETTES)) {
    assert.deepEqual(designContrast({ ...palette, id, name: id, base: "core", fonts: {} }).filter(row => !row.ok), [], id);
    for (const mode of ["light", "dark"] as const) for (const role of ["ink", "ink-muted", "accent", "focus", "line-control"] as const) {
      const minimum = ["focus", "line-control"].includes(role) ? 3 : 4.5;
      assert.ok(contrast(palette[mode][role], palette[mode]["accent-soft"]) >= minimum, `${id}/${mode}/${role}`);
    }
  }
});

test("new presentation contracts retain old implementations and portable props in all systems", () => {
  const props = { title: "A colourful opening", level: 1, scale: "hero", palette: "ocean", backdrop: "wash" };
  const fresh = render("core/section@1.1.0", props), old = render("core/section@1.0.0", props);
  assert.match(fresh, /kg-palette-ocean/); assert.match(fresh, /<h1/); assert.doesNotMatch(old, /kg-palette-ocean|<h1/);
  assert.notEqual(K.implementation("core/diagram@1.1.0"), K.implementation("core/diagram@1.2.0"));
  for (const system of ["core", "ledger", "atelier"]) {
    assert.equal(resolve(system, "section").ref, "core/section@1.1.0");
    assert.equal(resolve(system, "diagram").ref, "core/diagram@1.5.0");
    const result = validate(showcaseExamples(system)[0]);
    assert.equal(result.portable, true, system); assert.deepEqual(result.errors, [], system);
  }
});

test("diagram nodes own their complete keyboard target, expose selection and wrap long labels", () => {
  const html = render("core/diagram@1.2.0", { label: "Ownership", interactive: true, selected: "a", nodes: [{ id: "a", label: "A provider with a longer descriptive label", palette: "violet", group: "Provider" }, { id: "b", label: "Reader", palette: "mint" }], edges: [{ from: "a", to: "b", label: "shares" }] });
  assert.match(html, /kg-diagram__desktop/); assert.match(html, /kg-diagram__mobile/);
  assert.match(html, /<g[^>]+role="button"[^>]+tabindex="0"[^>]+aria-pressed="true"/);
  assert.match(html, /<tspan/); assert.match(html, /A provider with a longer descriptive label/);
  assert.match(html, /kg-palette-violet/); assert.match(html, /kg-palette-mint/);
  assert.match(html, /kg-diagram__edge/); assert.match(html, /kg-diagram__arrow/);
});

test("hostile palettes and labels stay data; cyclic, duplicate and missing graph nodes cannot break geometry", () => {
  const hostile = '<script>alert(1)</script>', badPalette = 'ocean" style="fill:url(javascript:x)';
  const html = render("core/diagram@1.2.0", { label: hostile, nodes: [{ id: "__proto__", label: hostile, palette: badPalette }, { id: "b", label: "B" }, { id: "b", label: "Duplicate" }], edges: [{ from: "__proto__", to: "b" }, { from: "b", to: "__proto__" }, { from: "missing", to: "b" }] });
  assert.doesNotMatch(html, /<script>|javascript:|NaN|Infinity|Duplicate/);
  assert.match(html, /&lt;script&gt;/); assert.match(html, /kg-palette-inherit/);
  assert.match(render("core/diagram@1.2.0", { label: "Empty", nodes: [] }), /No connections/);
  assert.doesNotMatch(render("core/section@1.1.0", { title: hostile, palette: badPalette, backdrop: badPalette }), /<script>|javascript:/);
});

test("diagram selection has a working public output without a custom handler", () => {
  const doc: KageDoc = { kages: "1.0", id: "selection", title: "Selection", system: "core@1", root: "d", blocks: { d: { type: "diagram", props: { label: "Pick", interactive: true, nodes: [{ id: "a", label: "A" }] } } } };
  const session = new KageSession(doc);
  assert.equal(session.read("d")?.selected, "");
  session.dispatch("d", "select", { id: "a" });
  assert.equal(session.read("d")?.selected, "a");
});
