// The exported page runs the app's own renderer, so a valid but hostile Kage must end as an error
// box on its own block, never a frozen or blank page. SSR cannot prove that: it needs real Chrome,
// the same way a Claude artifact frame would run it. Skipped where Chrome is not installed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cdp, findChrome, launch } from "../cli/screenshot.ts";
import { artifactHtml } from "./artifact.ts";
import { loadArtifactAssets } from "./artifact-assets.ts";
import type { KageDoc } from "../engine/types.ts";

const skip = !findChrome();
const nest = (d: number, n: number): unknown => d === 0 ? 1 : { $map: { list: { $literal: Array.from({ length: n }, (_, i) => i) }, to: nest(d - 1, n) } };
const ok = { type: "text", props: { text: "healthy sibling" } };
const kage = (blocks: Record<string, unknown>, state: Record<string, unknown> = {}) => ({ kages: "1.0", id: "h", title: "Hostile check", system: "core@1", root: "root", state, blocks }) as unknown as KageDoc;

async function inPage(doc: KageDoc, run: (ev: (s: string) => Promise<unknown>, wait: (s: string) => Promise<void>) => Promise<void>) {
  const file = join(mkdtempSync(join(tmpdir(), "kages-artifact-browser-")), "page.html");
  writeFileSync(file, `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>${artifactHtml(doc, loadArtifactAssets())}</body></html>`);
  const browser = await launch(findChrome()!, process.env.KAGES_CHROME_NO_SANDBOX === "1"), cdp = await Cdp.connect(browser.wsUrl);
  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" }), { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    const ev = async (s: string) => { const r = await cdp.send("Runtime.evaluate", { expression: s, returnByValue: true, awaitPromise: true }, sessionId); assert.equal(r.exceptionDetails, undefined, JSON.stringify(r.exceptionDetails)); return r.result.value; };
    const wait = async (s: string) => { for (let i = 0; i < 150; i++) { if (await ev(s)) return; await new Promise((r) => setTimeout(r, 100)); } throw new Error("Timed out: " + s); };
    await cdp.send("Page.navigate", { url: "file://" + file }, sessionId);
    await run(ev, wait);
  } finally { cdp.close(); browser.stop(); }
}

test("a Kage pinned to an older design-system build renders with that real bundle", { skip, timeout: 60000 }, async () => {
  // The oldest archived build in the repo: an immutable folder a signed Kage may still point at.
  const root = process.cwd(), old = readdirSync(join(root, "public/ds/versions")).sort()[0], base = `/ds/versions/${old}`;
  const integrity = JSON.parse(readFileSync(join(root, "public", base, "integrity.json"), "utf8"));
  const doc = { ...kage({ root: { type: "text", props: { text: "rendered by an archived bundle" } } }), resolved: { system: "core@1.0.0", blocks: { root: "core/text@1.0.0" }, assets: { base, integrity } } } as unknown as KageDoc;
  const file = join(mkdtempSync(join(tmpdir(), "kages-artifact-old-")), "page.html");
  writeFileSync(file, `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>${artifactHtml(doc, loadArtifactAssets(root, { base, integrity }))}</body></html>`);
  const browser = await launch(findChrome()!, process.env.KAGES_CHROME_NO_SANDBOX === "1"), cdp = await Cdp.connect(browser.wsUrl);
  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" }), { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId); await cdp.send("Page.navigate", { url: "file://" + file }, sessionId);
    const ev = async (s: string) => (await cdp.send("Runtime.evaluate", { expression: s, returnByValue: true }, sessionId)).result.value;
    for (let i = 0; i < 150 && !(await ev("document.body.innerText.includes('rendered by an archived bundle')")); i++) await new Promise((r) => setTimeout(r, 100));
    assert.equal(await ev("document.body.innerText.includes('rendered by an archived bundle')"), true);
    assert.equal(await ev("!!document.querySelector('[role=alert]')"), false);
  } finally { cdp.close(); browser.stop(); }
});

const texts = (ev: (s: string) => Promise<unknown>) => ev("[...document.querySelectorAll('[role=alert]')].map(e => e.textContent).join(' | ')") as Promise<string>;

test("a runaway expression stops at the shared work budget and only its own block fails", { skip, timeout: 60000 }, async () => {
  const doc = kage({ root: { type: "page", slots: { children: ["bad", "ok"] } }, bad: { type: "text", props: { text: "x" }, bind: { text: { $count: nest(4, 1000) } } }, ok });
  await inPage(doc, async (ev, wait) => {
    await wait("document.body.innerText.includes('healthy sibling')");
    assert.match(await texts(ev), /expression does too much work/);
  });
});

test("a block that throws is isolated and its healthy sibling stays", { skip, timeout: 60000 }, async () => {
  const doc = kage({ root: { type: "page", slots: { children: ["bad", "ok"] } }, bad: { type: "text", props: { text: "x" }, bind: { text: { $literal: { oops: "x" } } } }, ok });
  await inPage(doc, async (ev, wait) => {
    await wait("document.body.innerText.includes('healthy sibling')");
    assert.match(await texts(ev), /^bad — /);
  });
});

test("work that only appears after a click is bounded too, and the controls keep working", { skip, timeout: 60000 }, async () => {
  const doc = kage({ root: { type: "page", slots: { children: ["go", "bad", "ok"] } }, go: { type: "button", props: { label: "Reveal" }, on: { click: [{ do: "set", path: "show", value: true }] } }, bad: { type: "text", props: { text: "x" }, visible: { $state: "show" }, bind: { text: { $count: nest(4, 1000) } } }, ok }, { show: false });
  await inPage(doc, async (ev, wait) => {
    await wait("document.body.innerText.includes('healthy sibling')");
    assert.equal(await texts(ev), "");
    await ev("document.querySelector('button').click()");
    await wait("!!document.querySelector('[role=alert]')");
    assert.match(await texts(ev), /expression does too much work/);
    assert.equal(await ev("document.body.innerText.includes('healthy sibling')"), true);
    assert.equal(await ev("[...document.querySelectorAll('button')].some(b => b.textContent === 'Reveal')"), true);
  });
});
