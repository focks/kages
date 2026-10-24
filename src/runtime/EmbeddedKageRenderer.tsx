"use client";

// Runs only inside the opaque-origin artifact frame. Host capabilities are
// supplied through a message bridge; bundle failures cannot access dashboard DOM.
import * as React from "react";
import { resolve } from "@/engine/resolve.ts";
import { contracts } from "@/engine/data.ts";
import { evaluate, clone, merge, setPath, getPath } from "@/engine/expr.ts";
import { initLocals, makeCtx, materialize, runActions, systemOf, type Draft, type LogEntry, type HostTask } from "@/engine/runtime-core.ts";
import { HostBridge, type BridgeConfig } from "@/host/bridge.ts";
import type { KageDoc, Json, Contract, Block } from "@/engine/types.ts";
import { useDsBundle } from "./useDsBundle.ts";
import { designCss, readSnapshot, type DesignSnapshot } from "../engine/design.ts";
import { fetchState, fetchTracker } from "./fetch-state.ts";
import type { CapResult } from "../host/bridge.ts";

type Impl = React.ComponentType<Record<string, unknown>>;
type Bundle = { implementation?: (ref: string) => Impl | undefined; resolve: (system: string, ref: string) => { impl?: Impl } };

function MissingBox({ id, msg }: { id: string; msg: string }) {
  return React.createElement("div", { className: "kg-missing", role: "alert" }, React.createElement("strong", null, id), " — ", msg);
}

// A real per-block error boundary. A component that throws during render (a
// validated-but-weird doc, or a bug in a bundle component) is caught here and
// shown as an inline box, so one bad block can't take down the whole Kage —
// the architecture's "worst case is a per-block error box" guarantee.
class BlockErrorBoundary extends React.Component<
  { id: string; children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    return this.state.error
      ? React.createElement(MissingBox, { id: this.props.id, msg: this.state.error })
      : this.props.children;
  }
}

export interface KageRendererProps {
  doc: KageDoc;
  system?: string;
  dsBase?: string;
  assetIntegrity?: Record<string, string>;
  className?: string;
  onState?: (state: Record<string, Json>) => void;
  /** Host capability policy (fetch allowlist, connectors…). Absent → every
   *  fetch is denied: a Kage cannot reach the network unless its host opts in. */
  host?: BridgeConfig;
  onLayout?: (rects: Array<{ id: string; left: number; top: number; width: number; height: number }>) => void;
  onMetrics?: (metrics: import("../cli/screenshot.ts").PageMetrics) => void;
  onReady?: () => void;
  /** Fill the container and scroll inside the frame instead of growing to the content's height. A page that
   *  scrolls inside its frame is the only way a sticky contents rail can follow the reader without lag. */
  fill?: boolean;
  /** Dedicated guide pages can opt into host fragment navigation; embedded copies stay local. */
  navigation?: boolean;
  /** A design to dress the Kage in instead of the one its version pinned (an editor's live preview). */
  design?: DesignSnapshot;
  /** Force the frame's theme instead of following the host page (a design editor shows both side by side). */
  dark?: boolean;
  bridge?: Pick<HostBridge, "ask" | "invokeAgent" | "load" | "emit">;
}

export function EmbeddedKageRenderer({ doc, system, dsBase = "/ds", className, onState, host, bridge: remoteBridge, assetIntegrity, design: designOverride }: KageRendererProps) {
  const { kages, error } = useDsBundle(dsBase, doc.resolved?.assets?.integrity ?? assetIntegrity);
  const sysId = systemOf(doc, system);
  // The pinned snapshot is stored data like the rest of the document, so it is rebuilt through the design checks
  // before it becomes CSS; a tampered one simply renders in the system's own look.
  const design = React.useMemo(() => readSnapshot(designOverride ?? doc.resolved?.design), [designOverride, doc.resolved?.design]);
  const designStyle = React.useMemo(() => (design ? designCss(design) : ""), [design]);

  const [state, setState] = React.useState<Record<string, Json>>(() => clone(doc.state || {}));
  const [locals, setLocals] = React.useState(() => initLocals(doc, sysId));
  const fetches = React.useRef(fetchTracker());

  // The single gateway to the outside world. ask/agent/fetch/emit go through it,
  // so their capability gates (billing, registered agents, allowlist, rate limit)
  // apply. The viewer auto-permits the first model call for the demo; a real host
  // would prompt. Created once per document.
  const localBridge = React.useMemo(() => { const b = new HostBridge(doc, { billing: "viewer", ...host }); b.permitAsk(); return b; }, [doc, host]);

  const bridge = remoteBridge ?? localBridge;

  if (error) return React.createElement(MissingBox, { id: "bundle", msg: error });
  if (!kages) return React.createElement("div", { className: "kg-loading" }, "Loading design system…");

  const sys = (kages.systems as Record<string, { className: string; version: string }>)[sysId];
  if (!sys) return React.createElement(MissingBox, { id: "system", msg: `Unknown design system '${sysId}'` });

  const template = doc;
  try { doc = materialize(template, sysId, state, locals); }
  catch (e) { return React.createElement(MissingBox, { id: "collection", msg: (e as Error).message }); }
  const activeLocals = { ...initLocals(doc, sysId), ...locals };
  const ctx = makeCtx(doc, sysId, state, activeLocals);

  // Resolve a block to its implementation via the LOCKFILE first. A stored
  // version pins exact component refs in `resolved`; honouring them means an old
  // signed Kage renders with the components it was signed against, even if the
  // registry has since moved on. Only an unsaved doc (a draft not yet stored) falls back
  // to resolving live against the current system.
  function contractFor(id: string, b: Block): { ref?: string; contract?: Contract; error?: string } {
    const pin = doc.resolved?.blocks?.[id];
    if (pin) return contracts[pin] ? { ref: pin, contract: contracts[pin] } : { error: `Pinned contract unavailable: ${pin}` };
    return resolve(sysId, b.type);
  }

  function dispatch(id: string, evName: string, payload: Json) {
    const b = doc.blocks[id];
    const r = contractFor(id, b);
    if (!r.contract) return;
    const draft: Draft = { state: clone(state), locals: clone(activeLocals) };
    const log: LogEntry[] = [];
    const hostTasks: HostTask[] = [];
    const opts = { onHost: (t: HostTask) => hostTasks.push(t) };
    // Sync actions commit as one transaction; host actions were deferred with
    // pendingInto set, and now run through the bridge after the commit.
    runActions(doc, sysId, r.contract.defaults[evName], draft, id, payload, log, 0, opts);
    runActions(doc, sysId, (b.on || {})[evName], draft, id, payload, log, 0, opts);
    setState(draft.state);
    setLocals(draft.locals);
    onState?.(draft.state);
    for (const t of hostTasks) void runHost(t);
  }

  /** Run one deferred host action through the bridge and land its result in
   *  `into` (clearing `pendingInto`). An error writes null and clears pending —
   *  the Kage shows "no result", never a thrown render. */
  async function runHost(task: HostTask) {
    const a = task.action;
    let result: Json = null;
    let fetchResponse: CapResult | undefined;
    const tracked = a.do === "fetch" && typeof a.statusInto === "string" ? a.statusInto : "";
    const revision = tracked ? fetches.current.begin(tracked) : 0;
    try {
      if (a.do === "ask") {
        const res = await bridge.ask(String(task.prompt ?? ""), { model: a.model, schema: a.schema as Json });
        result = a.mock !== undefined ? (a.mock as Json) : res.ok ? (res.value ?? null) : null;
      } else if (a.do === "agent") {
        const res = await bridge.invokeAgent(a.agent ?? "", task.input ?? null);
        result = a.mock !== undefined ? (a.mock as Json) : res.ok ? (res.value ?? null) : null;
      } else if (a.do === "fetch") {
        // A live result wins; a denied or failed load falls back to the Kage's
        // own `mock` so previews and offline hosts still show something.
        const res = await bridge.load(a.source ?? "");
        fetchResponse = res;
        result = res.ok ? (res.value ?? null) : ((a.mock as Json) ?? null);
      } else if (a.do === "emit") {
        bridge.emit(a.name ?? "", task.args ?? null);
        return; // emit writes nothing back into state
      }
    } catch { result = null; fetchResponse = { ok: false, error: { code: "load_failed", msg: "The source could not be loaded." } }; }
    const completedAt = fetchResponse?.ok ? new Date().toISOString() : "";
    setState((prev) => {
      if (tracked && !fetches.current.current(tracked, revision)) return prev;
      const next = clone(prev);
      if (tracked && fetchResponse) {
        const settled = fetchState(a, fetchResponse, a.into ? getPath(prev, a.into) : null, getPath(prev, tracked), completedAt);
        result = settled.value;
        setPath(next, tracked, settled.outcome);
      }
      if (a.into) setPath(next, a.into, result);
      if (a.pendingInto) setPath(next, a.pendingInto, false);
      return next;
    });
  }

  function renderBlock(id: string, seen: Record<string, boolean>): React.ReactNode {
    if (seen[id]) return React.createElement(MissingBox, { key: id, id, msg: "slot cycle" });
    const b = doc.blocks[id];
    if (!b) return React.createElement(MissingBox, { key: id, id, msg: "no such block" });
    const r = contractFor(id, b);
    if (!r.contract || !r.ref) return React.createElement(MissingBox, { key: id, id, msg: r.error ?? "unresolved" });
    const c = r.contract;
    const ref = r.ref;
    const sub = merge(ctx, { self: id });
    // Visibility is evaluated inside the guard too — a throw here (e.g. a cycle
    // reached through `visible`) becomes an error box, not a crash.
    if (b.visible !== undefined) {
      let visible: boolean;
      try { visible = !!evaluate(b.visible, sub); }
      catch (e) { return React.createElement(MissingBox, { key: id, id, msg: (e as Error).message }); }
      if (!visible) return null;
    }

    let props: Record<string, unknown>;
    try {
      props = { ...ctx.output(id) }; // throws only on a reference cycle
    } catch (e) {
      return React.createElement(MissingBox, { key: id, id, msg: (e as Error).message });
    }

    const nseen = { ...seen, [id]: true };
    Object.keys(c.slots).forEach((sl) => {
      const kids = ((b.slots || {})[sl] || []).map((cid) => renderBlock(cid, nseen));
      if (sl === "children") props.children = kids;
      else props[sl] = kids;
    });
    Object.keys(c.events).forEach((ev) => {
      props[c.events[ev].handler] = (payload: Json) => dispatch(id, ev, payload);
    });

    // A role can have several immutable implementations in one trusted bundle.
    // Deriving an export name discarded the version and silently rendered new
    // section/diagram contracts with the old implementation.
    const bundle = kages as unknown as Bundle;
    const Impl = bundle.implementation ? bundle.implementation(ref) : bundle.resolve(sysId, ref).impl;
    if (!Impl) return React.createElement(MissingBox, { key: id, id, msg: `no implementation ${ref}` });
    return React.createElement(
      "div",
      { key: id, className: "kg-block", "data-block": id, "data-type": ref, style: { display: "contents" } },
      React.createElement(BlockErrorBoundary, { id, children: React.createElement(Impl, props) }),
    );
  }

  const page = React.createElement(
    "div",
    { className: ["kg-kage", sys.className, design && "kg-design", className].filter(Boolean).join(" "), "data-system": sysId + "@" + sys.version, ...(design ? { "data-design": design.id } : {}) },
    renderBlock(doc.root, {}),
  );
  // The CSS is assembled only from validated hex, catalogue font names and integers, so it carries no author text.
  return design ? React.createElement(React.Fragment, null, React.createElement("style", { dangerouslySetInnerHTML: { __html: designStyle } }), page) : page;
}
