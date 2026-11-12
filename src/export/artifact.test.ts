import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { artifactHtml, REACT_CDN, REACT_DOM_CDN, ARTIFACT_MAX_BYTES } from "./artifact.ts";
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
  assert.doesNotMatch(html, /<link\b|<img\b[^>]*src="https?:|fetch\(|XMLHttpRequest|WebSocket/);
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
  assert.throws(() => loadArtifactAssets("/nonexistent-kages-root"), /design-system bundle/);
  assert.ok(readFileSync(new URL("./artifact.ts", import.meta.url), "utf8").length > 0);
});
