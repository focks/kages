// A compromised component gets neither dashboard origin nor direct network APIs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sandboxHtml } from "./sandbox.ts";
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
