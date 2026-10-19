// Long repeated lists: only instances of a repeat may be skipped off screen, and rendering must scale in line with the size
// of the document (a quadratic step in expansion or rendering shows as a ratio far above the 4x growth in input).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { findChrome } from "../cli/screenshot.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { KageSession } from "../engine/session.ts";

const ds = fileURLToPath(new URL("../../public/ds/", import.meta.url));
const chrome = findChrome();

test("browser: a repeated card may be skipped off screen, a plain card never is", { skip: !chrome && "Chrome is not installed" }, () => {
  const file = join(tmpDir("kages-lists-"), "probe.html");
  writeFileSync(file, `<!doctype html><meta charset=utf-8><link rel=stylesheet href="file://${ds}tokens.css"><link rel=stylesheet href="file://${ds}bundle.css"><body>
<div class="kg-kage kg-sys-core"><div class="kg-block" data-block="list~/r1" style="display:contents"><div class="kg-card" id=rep></div></div>
<div class="kg-block" data-block="plain" style="display:contents"><div class="kg-card" id=one></div></div></div><pre id=out></pre>
<script>const cs = (id) => getComputedStyle(document.getElementById(id)).contentVisibility; document.getElementById("out").textContent = cs("rep") + "|" + cs("one");</script>`);
  const dom = execFileSync(chrome!, ["--headless=new", "--no-sandbox", "--disable-gpu", "--virtual-time-budget=3000", "--dump-dom", "file://" + file], { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "ignore"] });
  assert.match(dom, /<pre id="out">auto\|visible<\/pre>/);
});

test("browser: a sticky contents rail stays in view while the page scrolls", { skip: !chrome && "Chrome is not installed" }, () => {
  const file = join(tmpDir("kages-sticky-"), "probe.html");
  writeFileSync(file, `<!doctype html><meta charset=utf-8><link rel=stylesheet href="file://${ds}tokens.css"><link rel=stylesheet href="file://${ds}bundle.css"><body style="margin:0">
<div class="kg-kage kg-sys-core"><div style="display:grid;grid-template-columns:200px 1fr"><div><nav class="kg-toc kg-toc--sticky" id=toc>rail</nav></div><div style="height:4000px">long</div></div></div><pre id=out></pre>
<script>scrollTo(0, 2000); document.getElementById("out").textContent = "top=" + Math.round(document.getElementById("toc").getBoundingClientRect().top);</script>`);
  const dom = execFileSync(chrome!, ["--headless=new", "--no-sandbox", "--disable-gpu", "--window-size=1000,700", "--virtual-time-budget=3000", "--dump-dom", "file://" + file], { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "ignore"] });
  const top = Number(/top=(-?\d+)/.exec(dom)?.[1]);
  assert.ok(top >= 0 && top < 100, `the rail scrolled away (top=${top}); .kg-kage must not be a scroll container`);
});

function big(n: number) {
  const items = Array.from({ length: n }, (_, i) => ({ id: "r" + i, name: "Item " + i, price: i, tag: "t" + (i % 7) }));
  return { kages: "1.0", id: "big", title: "Big", system: "core@1", root: "page", state: {}, data: { items }, blocks: {
    page: { type: "stack", props: {}, slots: { children: ["list"] } },
    list: { type: "card", props: {}, repeat: { each: { $data: "items" }, key: "id" }, bind: { title: { $item: "name" } }, slots: { children: ["price"] } },
    price: { type: "text", props: {}, bind: { text: { $tpl: "${{item.price}} {{item.tag}}" } } },
  } } as never;
}
const median = (f: () => void) => { const t: number[] = []; for (let i = 0; i < 5; i++) { const a = performance.now(); f(); t.push(performance.now() - a); } return t.sort((x, y) => x - y)[2]; };

test("expansion and rendering grow in line with the number of repeated rows", () => {
  const window: any = { React };
  runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl, document: {} });
  const small = big(250), large = big(1000);
  const expand = (d: never) => median(() => { const s = new KageSession(d); s.instances(); });
  const render = (d: never) => median(() => renderToStaticMarkup(React.createElement(window.Kages.KageRenderer, { doc: d })));
  assert.ok(expand(large) < 1500, "1,000 rows expand within 1.5 s");
  assert.ok(render(large) < 3000, "1,000 rows render within 3 s even with React's development build");
  for (const [name, f] of [["expansion", expand], ["rendering", render]] as const) {
    const a = f(small), b = f(large);
    assert.ok(b < a * 4 * 3 + 20, `${name}: 4x the rows took ${(b / a).toFixed(1)}x as long (expected about 4x)`);
  }
});
