import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artifactHtml, assertPinsAvailable, hoistFontImports, ARTIFACT_MAX_BYTES } from "./artifact.ts";
import { loadArtifactAssets } from "./artifact-assets.ts";
import { resolveDesign, validateDesign } from "../engine/design.ts";
import { appExamples } from "../packs/examples.ts";

const assets = loadArtifactAssets();
const deck = appExamples().find((d) => d.id === "platform-review-deck")!;

test("an artifact page follows the Artifact tool's page contract", () => {
  const html = artifactHtml(deck, assets);
  assert.match(html, /^<title>Platform review deck<\/title>/);
  assert.doesNotMatch(html, /<!doctype|<html|<head|<body/i, "the host adds the skeleton");
  // The frame loads nothing but inline code: no external script, stylesheet, image, request or socket.
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/);
  assert.doesNotMatch(html, /<link\b(?![^>]*href="https:\/\/fonts\.googleapis\.com\/)|<img\b[^>]*src="https?:|fetch\(\s*["'`]http|XMLHttpRequest|WebSocket/);
  // The app's own renderer is inlined, then the bundle, and the page mounts through the runtime entry.
  assert.ok(html.includes(assets.runtimeJs.slice(0, 200)) && html.includes(assets.bundleJs.slice(0, 200)));
  assert.match(html, /__kagesArtifact\.mount\(/);
  assert.ok(html.indexOf(assets.runtimeJs.slice(0, 200)) < html.indexOf(assets.bundleJs.slice(0, 200)), "React is published before the bundle evaluates");
  // Theme: every token defined on bare :root, dark redefined twice, body takes it from a token.
  assert.match(html, /:root \{ --page-bg: #f4f2ec; \}/);
  assert.match(html, /@media \(prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\) \{ --page-bg: #141513; color-scheme: dark; \} \}/);
  assert.match(html, /:root\[data-theme="dark"\] \{ --page-bg: #141513; color-scheme: dark; \}/);
  assert.match(html, /body \{ background: var\(--page-bg\); \}/);
  assert.match(html, /padding-left: max\(16px, env\(safe-area-inset-left, 0px\)\)/);
  assert.ok(Buffer.byteLength(html) < ARTIFACT_MAX_BYTES);
});

test("document text can never close the inline elements around it", () => {
  const hostile = { ...deck, title: "</title><script>alert(1)</script>", blocks: { ...deck.blocks, talk: { type: "text", props: { value: "</script><script>alert(2)</script> & <!--" } } } };
  const html = artifactHtml(hostile, assets);
  assert.doesNotMatch(html, /<\/title><script>/);
  const json = /<script type="application\/json" id="kage-doc">([\s\S]*?)<\/script>/.exec(html)![1];
  assert.doesNotMatch(json, /</);
  assert.deepEqual(JSON.parse(json).title, hostile.title);
});

test("each system gets its own page ground and a missing bundle says so", () => {
  assert.match(artifactHtml({ ...deck, system: "ledger@2" }, assets), /--page-bg: #f6f7f5/);
  assert.match(artifactHtml({ ...deck, system: "atelier@1" }, assets), /--page-bg: #1a1614/);
  assert.throws(() => loadArtifactAssets("/nonexistent-kages-root"), /design-system build/);
  assert.ok(readFileSync(new URL("./artifact.ts", import.meta.url), "utf8").length > 0);
});

test("font imports become <link> tags ahead of every rule, because a late @import is ignored", () => {
  const real = readFileSync(new URL("../../public/ds/bundle.css", import.meta.url), "utf8");
  const h = hoistFontImports('@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=DM+Sans&display=swap");\n.a{color:red}\n@import "https://evil.example/x.css";');
  assert.deepEqual(h.links, ["https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=DM+Sans&display=swap"]);
  assert.equal(h.css.trim(), ".a{color:red}", "nothing of a semicolon-bearing URL may be left behind as CSS");
  // The shipped bundle loses only its import line, never a rule.
  const hoisted = hoistFontImports(real);
  assert.equal(hoisted.css, real.slice(real.indexOf("\n")));
  assert.ok(hoisted.css.includes("--kg-font-body: var(--font-sans)"));
  const html = artifactHtml(deck, assets);
  assert.match(html, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=[^"]+">/);
  assert.doesNotMatch(html.slice(html.indexOf("<style>"), html.indexOf("</style>")), /@import/);
  assert.equal((html.match(/<link\b/g) || []).length, 1, "the sheets share one font link");
});

test("a pinned workspace design adds its web fonts to the page", () => {
  const r = validateDesign({ id: "brand", name: "Brand", base: "core", colors: { light: { ink: "#112233" } }, fonts: { body: "Inter" } });
  if (!r.ok) throw new Error("the test design must validate");
  const html = artifactHtml({ ...deck, resolved: { ...(deck.resolved as object), design: resolveDesign(r.design) } as never }, assets);
  assert.match(html, /<link rel="stylesheet" href="[^"]*family=Inter[^"]*">/);
  // The design itself is applied by the app's renderer from the pinned snapshot inside the document JSON.
  assert.match(html, /"design":\{"id":"brand"/);
});

test("a Kage pinned to an older design-system build exports with that build, verified byte for byte", () => {
  const root = mkdtempSync(join(tmpdir(), "kages-artifact-"));
  const dir = join(root, "public/ds/versions/abc123");
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(root, "public/runtime"), { recursive: true });
  writeFileSync(join(root, "public/runtime/artifact.js"), "window.__kagesArtifact={}");
  const files = { "tokens.css": ".kg-kage{--paper:#fff}", "bundle.css": ".old{}", "bundle.js": "window.Kages={}" };
  for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, f), text);
  const sri = (t: string) => "sha384-" + createHash("sha384").update(t).digest("base64");
  const integrity = Object.fromEntries(Object.entries(files).map(([f, t]) => [f, sri(t)]));
  const got = loadArtifactAssets(root, { base: "/ds/versions/abc123", integrity });
  assert.equal(got.bundleCss, ".old{}");
  assert.throws(() => loadArtifactAssets(root, { base: "/ds/versions/abc123", integrity: { ...integrity, "bundle.js": sri("tampered") } }), /integrity/);
  assert.throws(() => loadArtifactAssets(root, { base: "/ds/versions/missing" }), /pinned/);
  assert.throws(() => loadArtifactAssets(root, { base: "/ds/../../etc" }), /invalid/);
  assert.throws(() => loadArtifactAssets(mkdtempSync(join(tmpdir(), "kages-noruntime-"))), /design-system build|runtime entry/);
});

test("a pinned contract the runtime no longer knows is refused with the block named, not published broken", () => {
  const pinned = (ref: string): any => ({ ...deck, resolved: { system: "core@1.0.0", blocks: { talk: ref } } });
  assert.doesNotThrow(() => assertPinsAvailable(pinned("core/deck@1.0.0")));
  assert.doesNotThrow(() => assertPinsAvailable(pinned("core/section@1.0.0")), "older refs the registry keeps still export");
  assert.throws(() => artifactHtml(pinned("core/removed-block@9.9.9"), assets), /block 'talk' pins core\/removed-block@9\.9\.9, which this build's runtime no longer includes/);
});
