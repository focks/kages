// Exercise real app routes and opaque frames with trusted wheel input. Documents
// are supplied through browser-local API stubs; no workspace is written/published.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Cdp, findChrome, launch } from "../cli/screenshot.ts";

const url = process.env.KAGES_TEST_URL;
const chrome = findChrome();
const doc = JSON.parse(readFileSync(new URL("../../public/ds/reader-account-explorer.kage.json", import.meta.url), "utf8"));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test("preview chains wheel input; published frames and comment overlays scroll without moving the host", { skip: !url || !chrome ? "Set KAGES_TEST_URL and install Chrome" : false, timeout: 60000 }, async () => {
  const browser = await launch(chrome!, process.env.KAGES_CHROME_NO_SANDBOX === "1");
  const cdp = await Cdp.connect(browser.wsUrl);
  try {
    let child: string | undefined;
    cdp.on((method, params) => { if (method === "Target.attachedToTarget" && params.targetInfo.type === "iframe") child = params.sessionId; });
    for (const path of ["/preview/scroll-test", "/k/scroll-test"]) {
      child = undefined;
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      const evaluate = async (expression: string, target = sessionId) => {
        const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, target);
        assert.equal(r.exceptionDetails, undefined, JSON.stringify(r.exceptionDetails));
        return r.result.value;
      };
      await cdp.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, sessionId);
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `const originalFetch=window.fetch;window.fetch=(url,...args)=>String(url).startsWith('/api/shared/')||String(url)==='/api/get_kage'?Promise.resolve(new Response(${JSON.stringify(JSON.stringify(doc))})):originalFetch(url,...args);` }, sessionId);
      await cdp.send("Page.navigate", { url: url + path }, sessionId);
      let ready = false;
      for (let i = 0; i < 100; i++) {
        if (child && await evaluate("!!document.querySelector('.kg-kage')", child)) { ready = true; break; }
        await delay(150);
      }
      assert.ok(ready, `${path} did not render`);
      await evaluate("document.fonts.ready.then(()=>true)", child);
      await delay(400);
      // Older pinned runtimes set this inline. Host-owned CSS must still choose
      // the correct scroll owner without substituting a signed runtime's bytes.
      await evaluate("document.documentElement.style.overscrollBehavior='contain'", child);
      const wheel = async () => {
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 300, y: 300, deltaX: 0, deltaY: 450 }, sessionId);
        await delay(400);
      };
      await wheel();
      if (path.startsWith("/preview/")) {
        assert.ok(await evaluate("scrollY") > 100, "wheel over preview must scroll host");
        assert.equal(await evaluate("scrollY", child), 0, "auto-height frame does not own scrolling");
        assert.equal(await evaluate("getComputedStyle(document.documentElement).overscrollBehavior", child), "auto");
      } else {
        const before = await evaluate("scrollY", child);
        assert.ok(before > 100, "published frame must scroll with wheel");
        assert.equal(await evaluate("scrollY"), 0);
        await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Comment').click()");
        await delay(100);
        await wheel();
        assert.ok(await evaluate("scrollY", child) > before + 100, "comment overlay must forward wheel");
        assert.equal(await evaluate("scrollY"), 0, "comment mode must not scroll host");
      }
      await cdp.send("Target.closeTarget", { targetId });
    }
  } finally { cdp.close(); browser.stop(); }
});
