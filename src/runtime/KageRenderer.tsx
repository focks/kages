"use client";

// @kages/runtime — the React renderer. All logic (resolution, output
// evaluation, the action transaction) comes from the pure engine; only the
// visual component implementations come from the loaded design-system bundle.
// That split is the whole point: the runtime is ours and testable headlessly
// (see KageSession), the components are trusted, versioned, swappable code. A
// validated document never throws here — every block renders inside an error
// boundary that falls back to an inline box, upholding the architecture
// invariant. See oracle/actions-runtime.feature and runtime-security.feature.
//
// Hardening in place: components are resolved from the document's LOCKFILE
// (contractFor), so a signed version renders with its pinned components; the
// bundle is loaded with Subresource Integrity (useDsBundle); host actions run
// through the capability-gated HostBridge (runHost); every block is wrapped in
// an error boundary. NOT yet in place: true iframe/own-origin isolation — the
// bundle still executes in the app window. The spec's model is a sandboxed
// iframe on a dedicated `<id>.kages-usercontent.app` origin, which needs
// deployment infrastructure (a separate origin serving the frame runtime with
// its own CORS + CSP). Until then the Kage runs in the dashboard document (the
// fullscreen preview overlay), with the per-block error boundary as the only
// in-app containment — see next.config.ts.

import * as React from "react";
import { resolve } from "@/engine/resolve.ts";
import { contracts } from "@/engine/data.ts";
import { evaluate, clone, merge, setPath } from "@/engine/expr.ts";
import { initLocals, makeCtx, materialize, runActions, systemOf, type Draft, type LogEntry, type HostTask } from "@/engine/runtime-core.ts";
import { HostBridge } from "@/host/bridge.ts";
import type { KageDoc, Json, Contract, Block } from "@/engine/types.ts";
import { useDsBundle } from "./useDsBundle.ts";

type Impl = React.ComponentType<Record<string, unknown>>;
type Bundle = Record<string, unknown>;

/** Map a contract ref ("ledger/dropdown@2.0.0") to its bundle export
 *  ("LedgerDropdown"). Inherited roles resolve to a core ref and so to a
 *  Core* export, which is exactly right — the parent's implementation runs,
 *  restyled by the active system's token scope. */
function exportName(ref: string): string {
  const [sysSlashName] = ref.split("@");
  const [sys, name] = sysSlashName.split("/");
  const pascal = (s: string) => s.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return pascal(sys) + pascal(name);
}

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
  className?: string;
  onState?: (state: Record<string, Json>) => void;
}

export function KageRenderer({ doc, system, dsBase = "/ds", className, onState }: KageRendererProps) {
  const { kages, error } = useDsBundle(dsBase);
  const sysId = systemOf(doc, system);

  const [state, setState] = React.useState<Record<string, Json>>(() => clone(doc.state || {}));
  const [locals, setLocals] = React.useState(() => initLocals(doc, sysId));

  // The single gateway to the outside world. ask/agent/fetch/emit go through it,
  // so their capability gates (billing, registered agents, allowlist, rate limit)
  // apply. The viewer auto-permits the first model call for the demo; a real host
  // would prompt. Created once per document.
  const bridge = React.useMemo(() => { const b = new HostBridge(doc, { billing: "viewer" }); b.permitAsk(); return b; }, [doc]);

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
  // registry has since moved on. Only an unsaved doc (studio draft) falls back
  // to resolving live against the current system.
  function contractFor(id: string, b: Block): { ref?: string; contract?: Contract; error?: string } {
    const pin = doc.resolved?.blocks?.[id];
    if (pin && contracts[pin]) return { ref: pin, contract: contracts[pin] };
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
    try {
      if (a.do === "ask") {
        const res = await bridge.ask(String(task.prompt ?? ""), { model: a.model, schema: a.schema as Json });
        result = a.mock !== undefined ? (a.mock as Json) : res.ok ? (res.value ?? null) : null;
      } else if (a.do === "agent") {
        const res = await bridge.invokeAgent(a.agent ?? "", task.input ?? null);
        result = a.mock !== undefined ? (a.mock as Json) : res.ok ? (res.value ?? null) : null;
      } else if (a.do === "fetch") {
        bridge.fetch(a.source ?? "");
        result = (a.mock as Json) ?? null;
      } else if (a.do === "emit") {
        bridge.emit(a.name ?? "", task.args ?? null);
        return; // emit writes nothing back into state
      }
    } catch { result = null; }
    setState((prev) => {
      const next = clone(prev);
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

    const Impl = (kages as Bundle)[exportName(ref)] as Impl | undefined;
    if (!Impl) return React.createElement(MissingBox, { key: id, id, msg: `no implementation ${exportName(ref)}` });
    return React.createElement(
      "div",
      { key: id, className: "kg-block", "data-block": id, "data-type": ref, style: { display: "contents" } },
      React.createElement(BlockErrorBoundary, { id, children: React.createElement(Impl, props) }),
    );
  }

  return React.createElement(
    "div",
    { className: ["kg-kage", sys.className, className].filter(Boolean).join(" "), "data-system": sysId + "@" + sys.version },
    renderBlock(doc.root, {}),
  );
}
