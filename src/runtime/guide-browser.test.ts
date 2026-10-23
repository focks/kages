// Check the opaque-frame/host navigation contract on real dedicated pages. API
// reads are local fixtures; this never changes sharing or writes a workspace.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Cdp, findChrome, launch } from "../cli/screenshot.ts";
const url = process.env.KAGES_TEST_URL;
const chrome = findChrome();
const doc = JSON.parse(readFileSync(new URL("../../public/ds/artifact-field-guide.kage.json", import.meta.url), "utf8"));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test("field guide supports deep links, history, mobile navigation, rich disclosures and retained state", { skip: !url || !chrome ? "Set KAGES_TEST_URL and install Chrome" : false, timeout: 60000 }, async () => {
  const browser = await launch(chrome!, process.env.KAGES_CHROME_NO_SANDBOX === "1");
  const cdp = await Cdp.connect(browser.wsUrl);
  try {
    let child: string | undefined;
    cdp.on((method, params) => { if (method === "Target.attachedToTarget" && params.targetInfo.type === "iframe") child = params.sessionId; });
    for (const path of ["/preview/guide-test", "/k/guide-test"]) {
      child = undefined;
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      const evaluate = async (expression: string, target = child!) => {
        const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, target);
        assert.equal(r.exceptionDetails, undefined, JSON.stringify(r.exceptionDetails)); return r.result.value;
      };
      await cdp.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, sessionId);
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `const originalFetch=window.fetch;window.fetch=(url,...args)=>String(url).startsWith('/api/shared/')||String(url)==='/api/get_kage'?Promise.resolve(new Response(${JSON.stringify(JSON.stringify(doc))})):originalFetch(url,...args);` }, sessionId);
      await cdp.send("Page.navigate", { url: url + path + "#evidence" }, sessionId);
      let ready = false;
      for (let i = 0; i < 100; i++) {
        if (child && await evaluate("document.querySelector('h1')?.textContent==='Caveats, with context.'")) { ready = true; break; }
        await delay(150);
      }
      assert.ok(ready, path + " deep link must open the evidence chapter");
      assert.equal(await evaluate("document.querySelectorAll('details.kg-disclosure').length"), 4);
      await evaluate("document.querySelector('.kg-guide__theme').click()"); await delay(100);
      assert.equal(await evaluate("document.documentElement.classList.contains('dark')"), true);
      await evaluate("document.querySelector('.kg-guide__theme').click()"); await delay(100);
      assert.equal(await evaluate("document.documentElement.classList.contains('dark')"), false);
      await evaluate("document.querySelector('details.kg-disclosure summary').click()"); await delay(100);
      assert.equal(await evaluate("document.querySelector('details.kg-disclosure').open"), true);
      const goto = async (id: string) => { await evaluate(`document.querySelector('.kg-guide__nav a[href="#${id}"]').click()`); await delay(150); };
      await goto("checklist");
      assert.equal(await evaluate("location.hash", sessionId), "#checklist");
      assert.equal(await evaluate("document.activeElement.tagName"), "MAIN");
      await evaluate("document.querySelector('input[type=checkbox]').click()");
      await goto("overview"); await goto("checklist");
      assert.equal(await evaluate("document.querySelector('input[type=checkbox]').checked"), true);
      await evaluate("history.back()", sessionId); await delay(250);
      assert.equal(await evaluate("document.querySelector('h1').textContent"), "Make the research usable.");
      await evaluate("history.forward()", sessionId); await delay(250);
      assert.equal(await evaluate("document.querySelector('h1').textContent"), "Review the experience.");
      // A compromised document cannot claim a chapter outside the host's allowlist.
      await evaluate("window.dispatchEvent(new CustomEvent('kages-navigate',{detail:{chapter:'missing'}}))"); await delay(100);
      assert.equal(await evaluate("location.hash", sessionId), "#checklist");
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId); await delay(150);
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.kg-guide__nav')).display"), "none");
      await evaluate("document.querySelector('.kg-guide__menu').click()");
      assert.equal(await evaluate("document.querySelector('.kg-guide__menu').getAttribute('aria-expanded')"), "true");
      await evaluate("document.querySelector('.kg-guide__menu').focus()");
      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" }, sessionId);
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" }, sessionId); await delay(100);
      assert.equal(await evaluate("document.querySelector('.kg-guide__menu').getAttribute('aria-expanded')"), "false");
      await evaluate("document.querySelector('.kg-guide__menu').click()"); await goto("evidence");
      assert.equal(await evaluate("document.querySelector('details.kg-disclosure').open"), true, "disclosure state survives chapter navigation");
      assert.equal(await evaluate("document.querySelector('.kg-guide__menu').getAttribute('aria-expanded')"), "false");
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      const before = await evaluate("scrollY");
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 200, y: 400, deltaX: 0, deltaY: 300 }, sessionId); await delay(250);
      assert.ok(await evaluate("scrollY") > before, "guide remains mouse-scrollable");
      assert.equal(await evaluate("scrollY", sessionId), 0, "dedicated guide owns its scroll");
      await cdp.send("Target.closeTarget", { targetId });
    }
  } finally { cdp.close(); browser.stop(); }
});
