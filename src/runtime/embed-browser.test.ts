// Two actual parent origins prove the browser enforces the published allowlist;
// an allowed origin must still render the ordinary opaque, pinned artifact frame.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Cdp, findChrome, launch } from "../cli/screenshot.ts";
import { polishExamples } from "../packs/polish-examples.ts";
const url = process.env.KAGES_TEST_URL;
const local = url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test("published embeds render only under allowed origins and deny host services", { skip: !local || !findChrome() ? "Requires local KAGES_TEST_URL and Chrome" : false, timeout: 90000 }, async (t) => {
  let uuid = "";
  const parent = () => createServer((_request, response) => { response.setHeader("Content-Type", "text/html"); response.end(`<iframe src="${url}/embed/${uuid}" style="width:100%;height:700px"></iframe>`); });
  const allowed = parent(), blocked = parent();
  t.after(() => { allowed.close(); blocked.close(); });
  await Promise.all([new Promise<void>(resolve => allowed.listen(0, "127.0.0.1", resolve)), new Promise<void>(resolve => blocked.listen(0, "127.0.0.1", resolve))]);
  const allowedOrigin = `http://127.0.0.1:${(allowed.address() as { port: number }).port}`;
  const blockedOrigin = `http://127.0.0.1:${(blocked.address() as { port: number }).port}`;
  const call = async (operation: string, params: object) => {
    const response = await fetch(url + "/api/" + operation, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(params) });
    const result = await response.json(); assert.ok(response.ok, JSON.stringify(result)); return result;
  };
  const doc = polishExamples()[0]; doc.id = "embed-test-" + randomUUID(); doc.meta = { embedOrigins: [allowedOrigin] };
  doc.sources = { sample: { from: "url", url: "https://example.com/sample.json" } };
  doc.state = { ...doc.state, loaded: [], loading: false, outcome: { status: "idle", message: "", updatedAt: "" } };
  doc.blocks.root.slots!.children.push("refresh", "loadResult", "sourceStatus");
  doc.blocks.refresh = { type: "button", props: { label: "Refresh example" }, on: { click: [{ do: "fetch", source: "sample", into: "loaded", pendingInto: "loading", statusInto: "outcome", mock: [{ label: "Sample" }] }] } };
  doc.blocks.loadResult = { type: "text", bind: { text: { $concat: ["Sample rows: ", { $count: { $state: "loaded" } }] } } };
  doc.blocks.sourceStatus = { type: "source-status", props: { label: "Source outcome" }, bind: { status: { $state: "outcome.status" }, message: { $state: "outcome.message" }, updatedAt: { $state: "outcome.updatedAt" }, loading: { $state: "loading" } } };
  const created = await call("create_kage", { doc }); uuid = created.version.uuid;
  await call("publish_kage", { name: doc.id, visibility: "link" });
  const browser = await launch(findChrome()!, process.env.KAGES_CHROME_NO_SANDBOX === "1"), cdp = await Cdp.connect(browser.wsUrl);
  try {
    const response = await fetch(url + "/embed/" + uuid);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-security-policy")?.includes(`frame-ancestors 'self' ${allowedOrigin}`), response.headers.get("content-security-policy") ?? "missing CSP");
    assert.equal(response.headers.get("x-frame-options"), null);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const sessions = new Set<string>(), messages: string[] = [];
    cdp.on((method, params) => {
      if (method === "Target.attachedToTarget" && params.targetInfo.type === "iframe") {
        const id = params.sessionId; sessions.add(id);
        void cdp.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, id).catch(() => {});
        void cdp.send("Log.enable", {}, id).catch(() => {});
      }
      if (method === "Target.detachedFromTarget") sessions.delete(params.sessionId);
      if (method === "Log.entryAdded") messages.push(params.entry.text);
    });
    await cdp.send("Page.enable", {}, sessionId); await cdp.send("Log.enable", {}, sessionId);
    await cdp.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, sessionId);
    let artifactSession = "";
    const rendered = async () => {
      for (const id of sessions) {
        try { const r = await cdp.send("Runtime.evaluate", { expression: "!!document.querySelector('.kg-canvas')", returnByValue: true }, id); if (r.result?.value) { artifactSession = id; return true; } } catch {}
      }
      return false;
    };
    await cdp.send("Page.navigate", { url: allowedOrigin }, sessionId);
    let ready = false;
    for (let i = 0; i < 150; i++) { if (await rendered()) { ready = true; break; } await delay(100); }
    assert.ok(ready, messages.join("\n"));
    await cdp.send("Runtime.evaluate", { expression: "[...document.querySelectorAll('button')].find(button => button.textContent === 'Refresh example').click()" }, artifactSession);
    let fallback = false;
    for (let i = 0; i < 30; i++) {
      const result = await cdp.send("Runtime.evaluate", { expression: "document.body.innerText.includes('Sample rows: 1')", returnByValue: true }, artifactSession);
      if (result.result?.value) { fallback = true; break; } await delay(100);
    }
    assert.ok(fallback, "the denied host request settles and uses the declared sample instead of hanging");
    const outcome = await cdp.send("Runtime.evaluate", { expression: "document.querySelector('.kg-source-status').textContent", returnByValue: true }, artifactSession);
    assert.match(outcome.result.value, /Sample data/); assert.match(outcome.result.value, /not a live update/);
    assert.doesNotMatch(outcome.result.value, /Last successful update/);
    await cdp.send("Page.navigate", { url: blockedOrigin }, sessionId);
    await delay(1000);
    assert.equal(await rendered(), false);
    assert.ok(messages.some(message => message.includes("frame-ancestors")), messages.join("\n"));
    await call("set_embed_policy", { name: doc.id, origins: [] });
    await call("publish_kage", { name: doc.id, visibility: "link" });
    assert.equal((await fetch(url + "/embed/" + uuid)).status, 403);
  } finally {
    cdp.close(); browser.stop(); allowed.close(); blocked.close(); await call("delete_kage", { name: doc.id });
  }
});
