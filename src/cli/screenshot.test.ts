// The visual review loop. Pure parts (argument parsing, Chrome discovery, the
// finding summaries, the MCP tool's guards) always run. The real-browser test
// runs when Chrome and a running Kages app are available — set KAGES_TEST_URL
// (and KAGES_CHROME_NO_SANDBOX=1 where Chrome needs it) — and is skipped
// otherwise, so `npm test` stays hermetic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findChrome, parseWidths, resolveBase, screenshotDoc, summarize, DEFAULTS, type PageMetrics } from "./screenshot.ts";
import { renderTool } from "./render-tool.ts";
import type { KageDoc } from "../engine/types.ts";

const clean: PageMetrics = { innerWidth: 390, scrollWidth: 390, scrollHeight: 900, blocks: 5, missing: [], brokenImages: [], overflowing: [], tinyText: [] };

test("widths: a list of sane viewport widths, or a clear refusal", () => {
  assert.deepEqual(parseWidths("390,1200"), [390, 1200]); assert.deepEqual(parseWidths(" 390 , 768 "), [390, 768]); assert.deepEqual(parseWidths(1200), [1200]); assert.deepEqual(parseWidths(undefined), DEFAULTS.widths);
  for (const bad of ["abc", "100", "9999", "390,390", "390,,x", "1.5", "-5", "1,2,3,4,5,6,7".replace(/\d/g, "400")]) assert.throws(() => parseWidths(bad), /--width/, bad);
});

test("chrome discovery honours an explicit path, searches PATH, and says nothing when absent", () => {
  const has = (...found: string[]) => (p: string) => found.includes(p);
  assert.equal(findChrome({ KAGES_CHROME: "/opt/c" }, has("/opt/c")), "/opt/c");
  assert.equal(findChrome({ KAGES_CHROME: "/opt/missing", PATH: "/usr/bin" }, has("/usr/bin/google-chrome")), undefined, "an explicit but wrong path is not silently replaced");
  assert.equal(findChrome({ PATH: "/a:/usr/local/bin" }, has("/usr/local/bin/chromium")), "/usr/local/bin/chromium");
  assert.equal(findChrome({ CHROME_PATH: "/x/chrome" }, has("/x/chrome")), "/x/chrome");
  assert.equal(findChrome({ PATH: "/a" }, () => false), undefined);
});

test("findings are written for a reviewer: render failures, sideways scroll, images, console, size", () => {
  assert.deepEqual(summarize(clean, [], false, 12000), []);
  const bad = summarize({ ...clean, blocks: 0, missing: ["no such block 'x'"], scrollWidth: 700, overflowing: ["@wide", "table"], brokenImages: ["https://x/y.png"], tinyText: ["@diagram 6.2px"] }, ["TypeError: boom"], true, 12000);
  assert.ok(bad.some((i) => /failed to render: no such block/.test(i)) && bad.some((i) => /scrolls sideways \(700px wide in a 390px viewport\); overflowing: @wide, table/.test(i)));
  assert.ok(bad.some((i) => /image did not load: https:\/\/x\/y\.png/.test(i)) && bad.some((i) => /console error: TypeError: boom/.test(i)));
  assert.ok(bad.some((i) => /too small to read in @diagram 6\.2px/.test(i)) && bad.some((i) => /taller than 12000px/.test(i)) && bad.some((i) => /empty page/.test(i)));
  assert.equal(summarize({ ...clean, scrollWidth: 391 }, [], false, 1).length, 0 + 0, "a pixel of rounding is not an overflow");
  assert.equal(summarize(clean, Array.from({ length: 20 }, (_, i) => "e" + i), false, 1).length, 5, "console noise is capped");
});

test("with no app running the error says how to start one (and never hangs)", async () => {
  await assert.rejects(() => resolveBase("http://127.0.0.1:9", {}), /no Kages app answered at http:\/\/127\.0\.0\.1:9\/render.*npm run dev/s);
  await assert.rejects(() => resolveBase(undefined, { KAGES_URL: "http://127.0.0.1:9" }), /answered at http:\/\/127\.0\.0\.1:9/);
});

test("the MCP render tool declares itself, ignores other tools and reports failures as tool errors", async () => {
  const tool = renderTool((name) => { if (name === "nope") throw new Error("no kage 'nope'"); return { kages: "1.0", id: "x", title: "X", system: "core@1", root: "r", blocks: { r: { type: "text", props: { text: "hi" } } } } as KageDoc; });
  assert.equal(tool.tools.length, 1); assert.equal((tool.tools[0] as any).name, "render_kage"); assert.ok((tool.tools[0] as any).inputSchema.properties.width);
  assert.equal(await tool.call("list_kages", {}), undefined, "other tools fall through to the operation table");
  const none: any = await tool.call("render_kage", {}); assert.equal(none.isError, true); assert.match(none.content[0].text, /name.*doc/);
  const missing: any = await tool.call("render_kage", { name: "nope" }); assert.equal(missing.isError, true); assert.match(missing.content[0].text, /no kage 'nope'/);
  const badWidth: any = await tool.call("render_kage", { name: "x", width: 5 }); assert.equal(badWidth.isError, true); assert.match(badWidth.content[0].text, /--width/);
});

const url = process.env.KAGES_TEST_URL, chrome = findChrome();
const skip = !url ? "KAGES_TEST_URL not set" : !chrome ? "no Chrome found" : false;
const shot = (doc: KageDoc | object, over: object = {}) => screenshotDoc(doc as KageDoc, { ...DEFAULTS, url, noSandbox: process.env.KAGES_CHROME_NO_SANDBOX === "1", ...over });

test("a real render returns a PNG of the right size with no findings for a healthy Kage", { skip }, async () => {
  const ops = JSON.parse(readFileSync(new URL("../../public/ds/ops-console.kage.json", import.meta.url), "utf8"));
  const [r] = await shot(ops, { widths: [1000] });
  assert.deepEqual([...r.png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]); assert.equal(r.width, 1000); assert.ok(r.height >= 900 && r.png.length > 5000);
  assert.deepEqual(r.issues, [], r.issues.join("; ")); assert.ok(r.metrics.blocks > 10);
});

test("a broken Kage is reported, not hidden, and dark mode and several widths work", { skip }, async () => {
  const broken = { kages: "1.0", id: "b", title: "B", system: "core@1", root: "r", blocks: { r: { type: "page", slots: { children: ["g"] } }, g: { type: "no-such-block" } } };
  const [r] = await shot(broken, { widths: [600] });
  assert.ok(r.issues.some((i) => /failed to render/.test(i)), r.issues.join("; "));
  const both = await shot({ ...broken, blocks: { r: { type: "page", slots: { children: ["t"] } }, t: { type: "text", props: { text: "Hello" } } } }, { widths: [390, 1200], dark: true });
  assert.deepEqual(both.map((x) => x.width), [390, 1200]); assert.deepEqual(both.map((x) => x.issues), [[], []]);
  assert.notDeepEqual(both[0].png, both[1].png);
});

test("tiny chart text is flagged, and wide figures scroll instead of shrinking on a phone", { skip }, async () => {
  const tiny = { kages: "1.0", id: "t", title: "T", system: "core@1", root: "r", blocks: { r: { type: "page", slots: { children: ["s"] } }, s: { type: "scene", props: { label: "S", width: 2000, height: 100, shapes: [{ kind: "text", x: 5, y: 40, text: "small", size: 8 }] } } } };
  assert.ok((await shot(tiny, { widths: [390] }))[0].issues.some((i) => /too small to read/.test(i)));
  const chart = { kages: "1.0", id: "c", title: "C", system: "core@1", root: "r", blocks: { r: { type: "page", slots: { children: ["c"] } }, c: { type: "combo-chart", props: { label: "C", categories: ["a", "b", "c"], series: [{ name: "x", kind: "bar", values: [1, 2, 3] }] } } } };
  const [r] = await shot(chart, { widths: [390] }); assert.deepEqual(r.issues, [], "a chart stays legible and the page does not scroll sideways: " + r.issues.join("; "));
});
