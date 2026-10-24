// This is platform-owned host code, never agent-authored HTML. It transfers one
// port to an opaque artifact frame and grants no ambient host capabilities.
import { createHash } from "node:crypto";
import { sandboxHtml } from "../runtime/sandbox.ts";
import { embedCsp } from "../store/embed-policy.ts";
import type { KageDoc } from "../engine/types.ts";
import assetsNow from "../../public/ds/assets.json" with { type: "json" };
import runtimeNow from "../../public/runtime/frame.json" with { type: "json" };

const bootstrap = `(()=>{
const model=JSON.parse(document.getElementById('payload').textContent),frame=document.getElementById('kage'),notice=document.getElementById('notice');
let port;
const theme=matchMedia('(prefers-color-scheme: dark)');
addEventListener('message',event=>{
 if(event.source!==frame.contentWindow||event.data?.type!=='kages-frame-ready'||port)return;
 const channel=new MessageChannel();port=channel.port1;
 port.onmessage=({data})=>{
  if(data?.type==='ready')port.postMessage({type:'render',dark:theme.matches,props:{doc:model.doc,fill:false,dsBase:model.base,assetIntegrity:model.integrity}});
  else if(data?.type==='layout'&&Number.isFinite(data.height)){frame.style.height=Math.max(48,Math.min(12000,data.height))+'px';notice.textContent=data.height>12000?'This embed is very long. Open the full Kage to continue.':'';}
  else if(data?.type==='settled')document.documentElement.dataset.ready='true';
  else if(data?.type==='host'&&Number.isSafeInteger(data.id))port.postMessage({type:'result',id:data.id,value:{ok:false,error:{code:'denied',msg:'Host capabilities are not enabled in this embed.'}}});
  else if(data?.type==='error')notice.textContent='This artifact could not be rendered.';
 };
 frame.contentWindow.postMessage({type:'kages-connect'},'*',[channel.port2]);
});
theme.addEventListener('change',()=>port?.postMessage({type:'theme',dark:theme.matches}));
frame.srcdoc=model.frameHTML;
})();`;

/** The JSON payload cannot terminate its inert script element. Runtime and DS
 * assets remain integrity-pinned; only the static bootstrap gets script authority. */
export function embedHtml(doc: KageDoc, uuid: string, origin: string, origins: string[], instance: string) {
  const base = new URL(origin).origin;
  const assets = doc.resolved?.assets ?? assetsNow;
  const model = { doc, base: new URL(assets.base, base).href, integrity: assets.integrity, frameHTML: sandboxHtml(base, assets.runtime ?? runtimeNow, assets.integrity, instance, assets.base, false) };
  const payload = JSON.stringify(model).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  const hash = "sha256-" + createHash("sha256").update(bootstrap).digest("base64");
  const href = "/k/" + encodeURIComponent(uuid);
  return { csp: embedCsp(origins, hash, [(assets.runtime ?? runtimeNow).integrity, assets.integrity["bundle.js"]], base), html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Embedded Kage</title><style>html,body{margin:0;padding:0}iframe{display:block;width:100%;border:0;min-height:48px}footer{font:13px system-ui;padding:12px;background:#fafafa;color:#222}a{color:#174c91}</style></head><body><iframe id="kage" title="Interactive Kage" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe><footer><span id="notice" role="status"></span> <a href="${href}" target="_blank" rel="noopener noreferrer">Open in Kages</a> · Inputs stay in this session; host services are disabled.</footer><script id="payload" type="application/json">${payload}</script><script>${bootstrap}</script></body></html>` };
}
