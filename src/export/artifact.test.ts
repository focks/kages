import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artifactHtml, assertPinsRenderable, assertRendersSafely, hoistFontImports, REACT_CDN, REACT_DOM_CDN, ARTIFACT_MAX_BYTES } from "./artifact.ts";
import { resolveDesign, validateDesign } from "../engine/design.ts";
import { loadArtifactAssets } from "./artifact-assets.ts";
import { appExamples } from "../packs/examples.ts";

const assets = loadArtifactAssets();
const deck = appExamples().find((d) => d.id === "platform-review-deck")!;

test("an artifact page follows the Artifact tool's page contract", () => {
  const html = artifactHtml(deck, assets);
  assert.match(html, /^<title>Platform review deck<\/title>/);
  assert.doesNotMatch(html, /<!doctype|<html|<head|<body/i, "the host adds the skeleton");
  // Only allowlisted script hosts, with exact pinned versions; nothing else may load.
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(srcs, [REACT_CDN, REACT_DOM_CDN]);
  assert.ok(srcs.every((u) => u.startsWith("https://cdnjs.cloudflare.com/ajax/libs/") && /\/\d+\.\d+\.\d+\//.test(u)));
  assert.doesNotMatch(html, /<link\b(?![^>]*href="https:\/\/fonts\.googleapis\.com\/)|<img\b[^>]*src="https?:|fetch\(|XMLHttpRequest|WebSocket/);
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
  assert.doesNotMatch(html.slice(html.indexOf("<style>")), /@import/);
  assert.equal((html.match(/<link\b/g) || []).length, 1, "the three sheets share one font link");
});

test("a pinned workspace design restyles the exported page", () => {
  const r = validateDesign({ id: "brand", name: "Brand", base: "core", colors: { light: { ink: "#112233" } }, fonts: { body: "Inter" } });
  if (!r.ok) throw new Error("the test design must validate");
  const html = artifactHtml({ ...deck, resolved: { ...(deck.resolved as object), design: resolveDesign(r.design) } as never }, assets);
  assert.match(html, /\.kg-kage\.kg-design\{/);
  assert.match(html, /className: "kg-design"/);
  assert.match(html, /family=Inter/);
  assert.doesNotMatch(artifactHtml(deck, assets), /kg-design"/);
});

test("a Kage pinned to an older design-system build exports with that build, verified byte for byte", () => {
  const root = mkdtempSync(join(tmpdir(), "kages-artifact-"));
  const dir = join(root, "public/ds/versions/abc123");
  mkdirSync(dir, { recursive: true });
  const files = { "tokens.css": ".kg-kage{--paper:#fff}", "bundle.css": ".old{}", "bundle.js": "window.Kages={}" };
  for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, f), text);
  const sri = (t: string) => "sha384-" + createHash("sha384").update(t).digest("base64");
  const integrity = Object.fromEntries(Object.entries(files).map(([f, t]) => [f, sri(t)]));
  const got = loadArtifactAssets(root, { base: "/ds/versions/abc123", integrity });
  assert.equal(got.bundleCss, ".old{}");
  assert.throws(() => loadArtifactAssets(root, { base: "/ds/versions/abc123", integrity: { ...integrity, "bundle.js": sri("tampered") } }), /integrity/);
  assert.throws(() => loadArtifactAssets(root, { base: "/ds/versions/missing" }), /pinned/);
  assert.throws(() => loadArtifactAssets(root, { base: "/ds/../../etc" }), /invalid/);
});

test("a legacy Kage whose component pins differ from this build is refused, not rendered differently", () => {
  const pinned = (ref: string, withAssets = false): any => ({ ...deck, resolved: { system: "core@1.0.0", blocks: { talk: ref }, ...(withAssets ? { assets: { base: "/ds", integrity: {} } } : {}) } });
  assert.doesNotThrow(() => assertPinsRenderable(pinned("core/deck@1.0.0")));
  assert.throws(() => artifactHtml(pinned("core/section@1.0.0"), assets), /pins core\/section@1\.0\.0 but this build renders core\/section@1\.1\.0/);
  assert.doesNotThrow(() => assertPinsRenderable(pinned("core/section@1.0.0", true)), "pinned assets carry their own contracts");
  // A Ledger document may use a core block; its pin is judged against core, not against Ledger's default.
  assert.doesNotThrow(() => assertPinsRenderable({ ...pinned("core/button@1.1.0"), system: "ledger@2" } as never));
  assert.throws(() => assertPinsRenderable({ ...pinned("ledger/button@1.0.0"), system: "ledger@2" } as never), /pins ledger\/button@1\.0\.0/);
});

test("a valid Kage that would hang or crash the exported renderer is refused before export", () => {
  const nest = (d: number, n: number): unknown => d === 0 ? 1 : { $map: { list: { $literal: Array.from({ length: n }, (_, i) => i) }, to: nest(d - 1, n) } };
  const bad = (props: Record<string, unknown>, bind: Record<string, unknown>) => ({ ...deck, blocks: { root: { type: "page", props: { width: "wide" }, slots: { children: ["t", "ok"] } }, t: { type: "text", props, bind }, ok: { type: "text", props: { text: "healthy sibling" } } } }) as never;
  // Runaway work: the shared engine stops this with a budget error; the exported renderer has no such budget.
  assert.throws(() => artifactHtml(bad({ text: "x" }, { text: { $count: nest(4, 1000) } }), assets), /cannot be exported as an artifact page because it needed more than 3s/);
  // A component that throws would blank the whole page in the exported root.
  assert.throws(() => artifactHtml(bad({ text: "x" }, { text: { $literal: { oops: "x" } } }), assets), /cannot be exported as an artifact page because/);
  assert.doesNotThrow(() => assertRendersSafely(deck, assets));
  // The page also carries a root boundary so a runtime failure shows a notice, not an empty frame.
  assert.match(artifactHtml(deck, assets), /getDerivedStateFromError/);
});
