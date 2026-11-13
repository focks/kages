// The browser entry for an exported artifact page. Claude's Artifact frame has no parent window to
// hand us a message port and may load nothing but inline code, so this mounts the app's own renderer
// directly. That keeps the protections a Kage relies on: the shared engine's expression work budget,
// per-block error boundaries and the capability gates. Host capabilities (ask, agent, fetch, emit)
// are denied, as in an embed. The page evaluates the design-system bundle itself, after this file has
// published React, and tells the renderer not to fetch it.
import * as React from "react";
import * as ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import { EmbeddedKageRenderer } from "./EmbeddedKageRenderer.tsx";
import type { HostBridge } from "../host/bridge.ts";
import type { KageDoc } from "../engine/types.ts";

const denied = async () => ({ ok: false, error: { code: "denied", msg: "Host capabilities are not available in an exported artifact." } });
const bridge = { ask: denied, invokeAgent: denied, load: denied, emit: () => {} } as unknown as Pick<HostBridge, "ask" | "invokeAgent" | "load" | "emit">;

// The design-system bundle reads window.React when it evaluates, so publish ours first.
(window as unknown as { React: typeof React; ReactDOM: typeof ReactDOM }).React = React;
(window as unknown as { ReactDOM: typeof ReactDOM }).ReactDOM = ReactDOM;

(window as unknown as { __kagesArtifact: unknown }).__kagesArtifact = {
  mount(el: HTMLElement, doc: KageDoc) {
    createRoot(el).render(React.createElement(EmbeddedKageRenderer, { doc, bridge, bundleLoaded: true }));
  },
};
