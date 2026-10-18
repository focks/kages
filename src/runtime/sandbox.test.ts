// A compromised component gets neither dashboard origin nor direct network APIs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sandboxHtml, FONTS_CSS } from "./sandbox.ts";
import runtime from "../../public/runtime/frame.json" with { type: "json" };
import assets from "../../public/ds/assets.json" with { type: "json" };
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("frames allow only pinned scripts and deny ambient network and form submission", () => {
  const html = sandboxHtml("https://host.example", runtime, assets.integrity, "test");
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.match(html, /base-uri 'none'/);
  assert.ok(!html.includes("unsafe-eval") && !html.includes("script-src 'unsafe-inline'"));
  assert.throws(() => sandboxHtml("https://host.example", runtime, {}, "test"), /integrity/);
  const wrapper = readFileSync(new URL("./SandboxedKage.tsx", import.meta.url), "utf8");
  assert.ok(!wrapper.includes("allow-same-origin"));
});

test("all pinned assets, including the engine runtime, retain their exact bytes", () => {
  for (const [file, sri] of Object.entries(assets.integrity)) {
    const bytes = readFileSync(new URL(`../../public${assets.base}/${file}`, import.meta.url));
    assert.equal("sha384-" + createHash("sha384").update(bytes).digest("base64"), sri);
  }
  const bytes = readFileSync(new URL(`../../public${assets.runtime.path}`, import.meta.url));
  assert.equal("sha384-" + createHash("sha384").update(bytes).digest("base64"), assets.runtime.integrity);
});

test("untrusted asset paths cannot inject markup into the frame document", () => {
  assert.throws(() => sandboxHtml("https://host.example", { ...runtime, path: '/runtime/x.js" onload="alert(1)' }, assets.integrity, "test"), /asset path/);
});

test("the frame preloads its pinned design-system files so they download beside the runtime, never from a foreign path", () => {
  const html = sandboxHtml("https://host.example", runtime, assets.integrity, "test", assets.base);
  for (const f of ["tokens.css", "bundle.css", "bundle.js"]) assert.ok(html.includes(`href="https://host.example${assets.base}/${f}" integrity="${(assets.integrity as Record<string, string>)[f]}" crossorigin="anonymous"`), f);
  assert.ok(html.indexOf('rel="preload"') < html.indexOf("<script"), "preloads start before the runtime script");
  assert.doesNotMatch(sandboxHtml("https://host.example", runtime, assets.integrity, "test", '/ds/x" onload="alert(1)'), /preload/);
  assert.doesNotMatch(sandboxHtml("https://host.example", runtime, assets.integrity, "test", "https://evil.example/ds"), /preload/);
  assert.doesNotMatch(sandboxHtml("https://host.example", runtime, assets.integrity, "test"), /preload/, "no base, no preload");
});

test("the fonts stylesheet requested up front is the one the bundle imports, and its hosts are allowed by the frame policy", () => {
  assert.ok(readFileSync(new URL("../../public/ds/bundle.css", import.meta.url), "utf8").includes(`@import url("${FONTS_CSS}")`));
  const html = sandboxHtml("https://host.example", runtime, assets.integrity, "test", assets.base);
  assert.ok(html.includes(`<link rel="stylesheet" href="${FONTS_CSS}">`));
  assert.match(html, /style-src [^;]*https:\/\/fonts\.googleapis\.com/); assert.match(html, /font-src [^;]*https:\/\/fonts\.gstatic\.com/);
  assert.ok(html.includes('rel="preconnect" href="https://fonts.gstatic.com" crossorigin'));
});
