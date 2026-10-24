// The same rules as surfaces.test.ts / motion.test.ts, but read back from a REAL
// browser's computed styles, because static CSS can look right and lose a cascade
// fight. Runs only when Chrome is installed (skips otherwise), against static files,
// so it needs no server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findChrome } from "../cli/screenshot.ts";
import { tmpDir } from "../test-support/tmp.ts";

const chrome = findChrome();
const ds = fileURLToPath(new URL("../../public/ds/", import.meta.url));

function probe(extraFlags: string[]): Record<string, string> {
  const dir = tmpDir("kages-surfaces-");
  // Network fonts are irrelevant to these token assertions; the CSP keeps a
  // slow font host from blocking the real CSS cascade probe.
  const html = `<!doctype html><meta charset=utf-8>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' file:; script-src 'unsafe-inline'">
<link rel=stylesheet href="file://${ds}tokens.css"><link rel=stylesheet href="file://${ds}bundle.css">
<body>
<div id=light class="kg-kage kg-sys-core"><p id=p1>text</p><input id=in1 placeholder="x"><div class="kg-tabs" id=tabs1></div><aside class="kg-side" id=side></aside></div>
<div class=dark><div id=dark class="kg-kage kg-sys-ledger"><p>text</p></div></div>
<pre id=out></pre>
<script>
const cs = (el, p) => getComputedStyle(el, p || null);
const r = {
  lightScheme: cs(document.getElementById("light")).colorScheme,
  darkScheme: cs(document.getElementById("dark")).colorScheme,
  caret: cs(document.getElementById("light")).caretColor,
  accentColor: cs(document.getElementById("light")).accentColor,
  placeholder: cs(document.getElementById("in1"), "::placeholder").color,
  selection: cs(document.getElementById("p1"), "::selection").backgroundColor,
  tabsScrollbar: cs(document.getElementById("tabs1")).scrollbarWidth,
  sideTransition: cs(document.getElementById("side")).transitionDuration,
  motionToken: cs(document.getElementById("light")).getPropertyValue("--motion-duration-fast").trim(),
  hostRootScheme: cs(document.documentElement).colorScheme,
};
document.getElementById("out").textContent = JSON.stringify(r);
</script>`;
  const file = join(dir, "probe.html");
  writeFileSync(file, html);
  const dom = execFileSync(chrome!, ["--headless=new", "--no-sandbox", "--disable-gpu", `--user-data-dir=${tmpDir("kages-surface-profile-")}`, "--virtual-time-budget=3000", "--dump-dom", ...extraFlags, "file://" + file], { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "ignore"] });
  const m = /<pre id="out">(.*?)<\/pre>/s.exec(dom);
  assert.ok(m, "the probe page did not run");
  return JSON.parse(m![1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
}

test("browser: surfaces are themed from the tokens and scoped to the Kage", { skip: !chrome && "Chrome is not installed" }, () => {
  const r = probe([]);
  assert.equal(r.lightScheme, "light");
  assert.equal(r.darkScheme, "dark", "a dark Kage gets dark native controls");
  assert.equal(r.hostRootScheme, "normal", "the host page's own color-scheme is untouched");
  assert.notEqual(r.caret, "auto");
  assert.equal(r.caret, r.accentColor, "caret and form accent both come from the system accent");
  assert.notEqual(r.selection, "rgba(0, 0, 0, 0)", "selection is themed");
  assert.equal(r.tabsScrollbar, "thin", "the tab strip scrollbar is visible, not hidden");
  assert.equal(r.motionToken, "120ms");
});

test("browser: with reduced motion requested, nothing in a Kage animates", { skip: !chrome && "Chrome is not installed" }, () => {
  const normal = probe([]), reduced = probe(["--force-prefers-reduced-motion"]);
  assert.notEqual(normal.sideTransition, "0s", "without the preference the reference sidebar still animates");
  assert.match(reduced.sideTransition, /^(0|1e-05|0\.00001)/, `reduced: ${reduced.sideTransition}`);
});
