// Content-hashed assets are cached for good; the unhashed aliases are not. A frame that revalidates ~600 KB on every
// artifact view is slow for no reason, and caching an alias forever would pin readers to a stale design system.
import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../../next.config.ts";
import { readdirSync } from "node:fs";

test("hashed design-system and runtime files are immutable; their aliases are not", async () => {
  const rules = await nextConfig.headers!();
  const cache = rules.filter((r) => r.headers.some((h) => h.key === "Cache-Control" && /immutable/.test(h.value)));
  assert.deepEqual(cache.map((r) => r.source).sort(), ["/ds/versions/:hash([A-Za-z0-9_-]+)/:file", "/runtime/:file([A-Za-z0-9_-]{16,}\\.js)"]);
  for (const r of cache) assert.ok(r.headers.some((h) => h.value === "public, max-age=31536000, immutable"));
  const files = readdirSync(new URL("../../public/runtime/", import.meta.url));
  assert.ok(files.some((f) => /^[A-Za-z0-9_-]{16,}\.js$/.test(f)), "the runtime build is a hashed .js");
  assert.ok(!/^[A-Za-z0-9_-]{16,}\.js$/.test("frame.json"), "the manifest alias is not matched");
  assert.ok(!cache.some((r) => /^\/ds\/(bundle|tokens)/.test(r.source)), "no rule caches /ds/bundle.js");
});
