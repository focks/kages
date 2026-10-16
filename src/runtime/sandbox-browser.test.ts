// Prove browser enforcement, not just the presence of sandbox/CSP strings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { findChrome } from "../cli/screenshot.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { sandboxHtml } from "./sandbox.ts";
const chrome = findChrome();

test("a compromised pinned script cannot read parent DOM/cookies or fetch authenticated APIs", { skip: !chrome && "Chrome unavailable" }, async () => {
  const script = `
    (async () => {
      let dom = false, cookies = false, network = false;
      try { parent.document.body; dom = true; } catch {}
      try { document.cookie; cookies = true; } catch {}
      try { await fetch('/secret', {credentials:'include'}); network = true; } catch {}
      parent.postMessage({dom,cookies,network}, '*');
    })();`;
  const integrity = "sha384-" + createHash("sha384").update(script).digest("base64");
  let secretRequests = 0;
  const server = createServer((req, res) => {
    if (req.url === "/runtime/attack.js") { res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Content-Type", "text/javascript"); res.end(script); return; }
    if (req.url === "/secret") { secretRequests++; res.end("secret"); return; }
    const address = server.address() as { port: number };
    const html = sandboxHtml(`http://127.0.0.1:${address.port}`, { path: "/runtime/attack.js", integrity }, { "bundle.js": integrity }, "test");
    res.setHeader("Content-Type", "text/html");
    res.end(`<pre id="out">waiting</pre><script>const f=document.createElement('iframe');f.sandbox='allow-scripts';f.srcdoc=${JSON.stringify(html).replace(/</g, "\\u003c")};window.addEventListener('message',e=>{if(e.source===f.contentWindow) document.getElementById('out').textContent=JSON.stringify(e.data)});document.body.append(f)</script>`);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address() as { port: number };
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--no-sandbox", "--disable-gpu", `--user-data-dir=${tmpDir("kages-sandbox-")}`, "--virtual-time-budget=3000", "--dump-dom", `http://127.0.0.1:${port}`], { timeout: 20000, maxBuffer: 1024 * 1024 });
    const output = /<pre id="out">(.*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(output && output !== "waiting", stdout);
    assert.deepEqual(JSON.parse(output!), { dom: false, cookies: false, network: false });
    assert.equal(secretRequests, 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
