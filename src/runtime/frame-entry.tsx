// This entry is bundled separately from Next: opaque frames receive data, never
// dashboard code or ambient credentials. Only a transferred port can invoke it.
import { measurePage } from "./measure.mjs";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { EmbeddedKageRenderer, type KageRendererProps } from "./EmbeddedKageRenderer.tsx";
import type { HostBridge } from "../host/bridge.ts";

const root = createRoot(document.getElementById("root")!);
let port: MessagePort | undefined;
window.addEventListener("error", event => { if (event.error) port?.postMessage({ type: "error", message: event.message }); });
window.addEventListener("unhandledrejection", event => port?.postMessage({ type: "error", message: String(event.reason) }));
let revision = 0;
let sequence = 0;
const pending = new Map<number, (v: unknown) => void>();
const rpc = (method: string, args: unknown[]) => new Promise<unknown>(resolve => {
  const id = ++sequence;
  pending.set(id, resolve);
  port!.postMessage({ type: "host", id, method, args });
});
const bridge = {
  ask: (...args: unknown[]) => rpc("ask", args),
  invokeAgent: (...args: unknown[]) => rpc("invokeAgent", args),
  load: (...args: unknown[]) => rpc("load", args),
  emit: (...args: unknown[]) => { void rpc("emit", args); },
} as Pick<HostBridge, "ask" | "invokeAgent" | "load" | "emit">;

window.addEventListener("message", event => {
  if (event.source !== parent || event.data?.type !== "kages-connect" || port || !event.ports[0]) return;
  port = event.ports[0];
  port.onmessage = ({ data }) => {
    if (data.type === "result") { pending.get(data.id)?.(data.value); pending.delete(data.id); return; }
    if (data.type === "theme") { document.documentElement.classList.toggle("dark", !!data.dark); return; }
    if (data.type !== "render") return;
    const props = data.props as KageRendererProps;
    document.documentElement.classList.toggle("dark", !!data.dark);
    root.render(<EmbeddedKageRenderer key={++revision} {...props} bridge={bridge} onState={state => port!.postMessage({ type: "state", state })} />);
  };
  port.postMessage({ type: "ready" });
});
// Union display:contents wrappers so discussion pins keep their semantic anchors.
function rectOf(el: Element, depth = 0): DOMRect | { left: number; top: number; width: number; height: number } | null {
  const r = el.getBoundingClientRect();
  if (r.width || r.height) return r;
  if (depth > 4) return null;
  const kids = [...el.children].map(e => rectOf(e, depth + 1)).filter(r => r !== null);
  if (!kids.length) return null;
  const left = Math.min(...kids.map(r => r.left)), top = Math.min(...kids.map(r => r.top));
  return { left, top, width: Math.max(...kids.map(r => r.left + r.width)) - left, height: Math.max(...kids.map(r => r.top + r.height)) - top };
}
let scheduled = false;
let settledRevision = 0;
function report() {
  scheduled = false;
  const metrics = measurePage();
  const rects = [...document.querySelectorAll("[data-block]")].flatMap(el => {
    const r = rectOf(el);
    return r ? [{ id: el.getAttribute("data-block"), left: r.left, top: r.top, width: r.width, height: r.height }] : [];
  });
  port?.postMessage({ type: "layout", rects, metrics, height: Math.ceil(document.body.getBoundingClientRect().height) });
  if ((document.querySelector(".kg-kage") || document.querySelector(".kg-missing")) && settledRevision !== revision) {
    settledRevision = revision;
    const current = revision;
    void document.fonts.ready.then(async () => {
      await Promise.race([Promise.all([...document.images].map(i => i.decode().catch(() => {}))), new Promise(r => setTimeout(r, 4000))]);
      setTimeout(() => { if (current === revision) { report(); port?.postMessage({ type: "settled" }); } }, 180);
    });
  }
}
function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(report); } }
new ResizeObserver(schedule).observe(document.body);
new MutationObserver(schedule).observe(document.getElementById("root")!, { attributes: true, childList: true, subtree: true });
parent.postMessage({ type: "kages-frame-ready" }, "*");
