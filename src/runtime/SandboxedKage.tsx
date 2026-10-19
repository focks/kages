"use client";
// MessagePort possession is the frame's only authority. The parent owns the
// capability policy; frame messages cannot supply credentials or replace it.
import * as React from "react";
import type { KageRendererProps } from "./EmbeddedKageRenderer.tsx";
import { HostBridge } from "../host/bridge.ts";
import { sandboxHtml } from "./sandbox.ts";
import currentAssets from "../../public/ds/assets.json";
import frameRuntime from "../../public/runtime/frame.json";

export function KageRenderer({ doc, system, className, onState, host, onLayout, onMetrics, onReady, fill }: KageRendererProps) {
  const frame = React.useRef<HTMLIFrameElement>(null);
  const [origin, setOrigin] = React.useState("");
  const [height, setHeight] = React.useState(48);
  const bridge = React.useMemo(() => { const b = new HostBridge(doc, { billing: "viewer", ...host }); b.permitAsk(); return b; }, [doc, host]);
  const current = React.useRef({ onState, bridge, onLayout, onMetrics, onReady });
  current.current = { onState, bridge, onLayout, onMetrics, onReady };
  const assets = doc.resolved?.assets ?? currentAssets;
  // Each document edit restarts execution and clears failed block boundaries.
  const frameDoc = React.useMemo(() => {
    try { return { html: origin ? sandboxHtml(origin, assets.runtime ?? frameRuntime, assets.integrity, crypto.randomUUID(), assets.base) : "", error: "" }; }
    catch (e) { return { html: "", error: `Artifact assets unavailable: ${(e as Error).message}` }; }
  }, [origin, doc, assets.integrity]);
  const html = frameDoc.html;
  React.useEffect(() => { setOrigin(location.origin); }, []);
  React.useEffect(() => {
    if (!origin || !html) return;
    let port: MessagePort | undefined;
    let disposed = false;
    const dark = () => document.documentElement.classList.contains("dark");
    const connect = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== "kages-frame-ready" || port) return;
      const channel = new MessageChannel(); port = channel.port1;
      port.onmessage = async ({ data }) => {
        if (data?.type === "error" && typeof data.message === "string") {
          console.error("Kage frame:", data.message.slice(0, 500));
        } else if (data?.type === "ready") {
          port!.postMessage({ type: "render", dark: dark(), props: { doc, system, assetIntegrity: assets.integrity, dsBase: new URL(assets.base, origin).href } });
        } else if (data?.type === "settled") {
          current.current.onReady?.();
        } else if (data?.type === "layout" && Number.isFinite(data.height)) {
          if (Array.isArray(data.rects)) current.current.onLayout?.(data.rects.filter((r: { id: unknown; left: number; top: number; width: number; height: number }) => typeof r.id === "string" && [r.left, r.top, r.width, r.height].every(Number.isFinite)));
          if (data.metrics && typeof data.metrics === "object") current.current.onMetrics?.(data.metrics);
          setHeight(Math.max(48, Math.min(12000, data.height)));
        } else if (data?.type === "state" && data.state && typeof data.state === "object" && !Array.isArray(data.state)) {
          current.current.onState?.(data.state);
        } else if (data?.type === "host" && Number.isSafeInteger(data.id) && Array.isArray(data.args)) {
          const b = current.current.bridge;
          const [first, second] = data.args;
          let value: unknown = { ok: false, error: { code: "forbidden", msg: "invalid host request" } };
          try {
            if (typeof first === "string") {
              if (data.method === "ask" && (second === undefined || second && typeof second === "object")) value = await b.ask(first, second);
              else if (data.method === "load") value = await b.load(first);
              else if (data.method === "invokeAgent") value = await b.invokeAgent(first, second ?? null);
              else if (data.method === "emit") value = b.emit(first, second ?? null);
            }
          } catch { value = { ok: false, error: { code: "host_error", msg: "host request failed" } }; }
          if (!disposed) port!.postMessage({ type: "result", id: data.id, value });
        }
      };
      frame.current!.contentWindow!.postMessage({ type: "kages-connect" }, "*", [channel.port2]);
    };
    window.addEventListener("message", connect);
    // The comment layer covers the frame and swallows the wheel; it hands the scroll back through this event.
    const frameEl = frame.current;
    const onScrollRequest = (e: Event) => { const d = (e as CustomEvent).detail; if (port && d && Number.isFinite(d.top) && Number.isFinite(d.left)) port.postMessage({ type: "scrollBy", left: d.left, top: d.top }); };
    frameEl?.addEventListener("kages-scroll", onScrollRequest);
    const observer = new MutationObserver(() => port?.postMessage({ type: "theme", dark: dark() }));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => { disposed = true; port?.close(); frameEl?.removeEventListener("kages-scroll", onScrollRequest); observer.disconnect(); window.removeEventListener("message", connect); };
  }, [origin, html, doc, system, assets.base]);
  if (frameDoc.error) return <div role="alert" className="kg-missing">{frameDoc.error}</div>;
  return <iframe ref={frame} title={doc.title || "Kage artifact"} className={className} srcDoc={html || undefined} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" style={{ width: "100%", height: fill ? "100%" : height, border: 0, display: "block" }} />;
}
