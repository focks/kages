import { test } from "node:test";
import assert from "node:assert/strict";
import { COLOR_ROLES, FONTS, baseRadius, basePalette, designContrast, designCss, googleFontsUrl, paletteFromBrand, readSnapshot, resolveDesign, validateDesign, type DesignDef } from "./design.ts";

const ok = (d: unknown) => { const r = validateDesign(d); assert.ok(r.ok, r.ok ? "" : r.errors.join("; ")); return r.design; };
const bad = (d: unknown) => { const r = validateDesign(d); assert.equal(r.ok, false); return r.ok ? [] : r.errors; };

test("a minimal design validates, normalises colours and drops nothing it accepts", () => {
  const d = ok({ id: "brand", name: " Brand ", base: "ledger", colors: { light: { accent: "#ABC" } }, fonts: { body: "Inter" }, radius: { lg: 12 } });
  assert.equal(d.name, "Brand");
  assert.equal(d.colors?.light?.accent, "#aabbcc");
  assert.deepEqual(d.fonts, { body: "Inter" });
});

test("everything outside the closed shape is rejected, with the field named", () => {
  assert.match(bad({ id: "Bad Id", name: "x", base: "core" }).join(), /id is/);
  assert.match(bad({ id: "a", name: "", base: "core" }).join(), /name is required/);
  assert.match(bad({ id: "a", name: "x", base: "nope" }).join(), /base is one of/);
  assert.match(bad({ id: "a", name: "x", base: "core", extra: 1 }).join(), /unknown field 'extra'/);
  assert.match(bad({ id: "a", name: "x", base: "core", colors: { light: { mystery: "#fff" } } }).join(), /unknown role/);
  assert.match(bad({ id: "a", name: "x", base: "core", colors: { light: { ink: "red" } } }).join(), /not a hex colour/);
  assert.match(bad({ id: "a", name: "x", base: "core", colors: { sepia: {} } }).join(), /only light and dark/);
  assert.match(bad({ id: "a", name: "x", base: "core", fonts: { body: "Comic Sans" } }).join(), /not in the font list/);
  assert.match(bad({ id: "a", name: "x", base: "core", radius: { md: 3.5 } }).join(), /whole number/);
  assert.match(bad({ id: "a", name: "x", base: "core", radius: { md: 999 } }).join(), /from 0 to/);
  assert.match(bad(null).join(), /an object/);
});

test("hostile values never reach the stylesheet", () => {
  for (const evil of ["red;} body{display:none", "#fff;}</style><script>x</script>", "url(https://evil.test/x)", "expression(alert(1))"]) {
    bad({ id: "a", name: "x", base: "core", colors: { light: { ink: evil } } });
    bad({ id: "a", name: "x", base: "core", fonts: { body: evil } });
  }
  const css = designCss(resolveDesign(ok({ id: "a", name: "x", base: "core", colors: { light: { ink: "#112233" } }, fonts: { body: "Inter", mono: "Fira Code" }, radius: { sm: 0, md: 2, lg: 4 } })));
  assert.doesNotMatch(css, /[<>]|script|expression|javascript/i);
  assert.match(css, /^@import url\("https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@400;500;600;700&family=Fira\+Code:wght@400;500;600&display=swap"\);/);
});

test("a design inherits every role it does not set, and its snapshot is complete in both themes", () => {
  const snap = resolveDesign(ok({ id: "a", name: "x", base: "atelier", colors: { dark: { accent: "#ffcc00" } } }));
  for (const mode of ["light", "dark"] as const) for (const r of COLOR_ROLES) assert.match(snap[mode][r], /^#[0-9a-f]{6}$/, `${mode}.${r}`);
  assert.equal(snap.light.accent, basePalette("atelier", "light").accent, "unset light role comes from the base");
  assert.equal(snap.dark.accent, "#ffcc00");
  assert.equal(snap.radius, undefined, "no radius set means the system keeps its own shape");
  assert.deepEqual(resolveDesign(ok({ id: "a", name: "x", base: "core", radius: { lg: 20 } })).radius, { ...baseRadius("core"), lg: 20 });
});

test("css: light rule, then a dark rule that restates every role", () => {
  const css = designCss(resolveDesign(ok({ id: "a", name: "x", base: "core" })));
  assert.match(css, /\.kg-kage\.kg-design\{--kg-paper:#/);
  assert.match(css, /\n\.dark \.kg-kage\.kg-design\{--kg-paper:#/);
  assert.equal((css.match(/--kg-focus:/g) || []).length, 2);
  assert.doesNotMatch(css, /@import/, "no fonts chosen, nothing to fetch");
  assert.equal(googleFontsUrl({}), null);
});

test("every catalogue font serves the weights it claims and has a unique name", () => {
  assert.equal(new Set(FONTS.map((f) => f.name)).size, FONTS.length);
  for (const f of FONTS) assert.match(f.w, /^\d{3}(;\d{3})*$/, f.name);
});

test("built-in systems clear their own contrast pairs, so the check is calibrated", () => {
  for (const base of ["core", "ledger", "atelier"] as const) {
    const failing = designContrast(resolveDesign({ id: "b", name: "b", base })).filter((r) => !r.ok);
    assert.deepEqual(failing.map((r) => `${r.mode}:${r.text}/${r.on}`), [], base);
  }
});

test("a brand colour becomes a palette that passes every contrast pair, whatever the colour", () => {
  for (const brand of ["#0b5fff", "#ffd400", "#ffffff", "#000000", "#e11d48", "#16a34a", "#7c3aed", "#9ca3af", "#ff6a00"]) {
    const p = paletteFromBrand(brand);
    assert.ok(p, brand);
    const def: DesignDef = { id: "g", name: "g", base: "core", colors: p };
    const failing = designContrast(resolveDesign(def)).filter((r) => !r.ok);
    assert.deepEqual(failing.map((r) => `${r.mode}:${r.text}/${r.on}=${r.ratio}`), [], brand);
    assert.ok(validateDesign(def).ok, brand);
  }
  assert.equal(paletteFromBrand("blue"), null);
});

test("a stored snapshot reads back through the same checks; tampered ones are dropped", () => {
  const snap = resolveDesign(ok({ id: "a", name: "x", base: "ledger", fonts: { display: "Lora" }, radius: { sm: 1, md: 2, lg: 3 } }));
  assert.deepEqual(readSnapshot(JSON.parse(JSON.stringify(snap))), snap);
  assert.equal(readSnapshot({ ...snap, light: { ...snap.light, ink: "red;}" } }), undefined);
  assert.equal(readSnapshot("nope"), undefined);
  assert.equal(readSnapshot({ ...snap, fonts: { body: "Comic Sans" } }), undefined);
});
