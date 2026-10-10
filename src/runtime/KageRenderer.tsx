"use client";

// @kages/runtime — the React renderer. All logic (resolution, output
// evaluation, the action transaction) comes from the pure engine; only the
// visual component implementations come from the loaded design-system bundle.
// That split is the whole point: the runtime is ours and testable headlessly
// (see KageSession), the components are trusted, versioned, swappable code. A
// validated document never throws here — every block renders inside an error
// boundary that falls back to an inline box, upholding the architecture
// invariant. See oracle/actions-runtime.feature and runtime-security.feature.

import * as React from "react";
import { resolve } from "@/engine/resolve.ts";
import { evaluate, clone, merge } from "@/engine/expr.ts";
import { initLocals, makeCtx, runActions, systemOf, type Draft, type LogEntry } from "@/engine/runtime-core.ts";
import type { KageDoc, Json } from "@/engine/types.ts";
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

  if (error) return React.createElement(MissingBox, { id: "bundle", msg: error });
  if (!kages) return React.createElement("div", { className: "kg-loading" }, "Loading design system…");

  const sys = (kages.systems as Record<string, { className: string; version: string }>)[sysId];
  if (!sys) return React.createElement(MissingBox, { id: "system", msg: `Unknown design system '${sysId}'` });

  const ctx = makeCtx(doc, sysId, state, locals);

  function dispatch(id: string, evName: string, payload: Json) {
    const b = doc.blocks[id];
    const r = resolve(sysId, b.type);
    if (!r.contract) return;
    const draft: Draft = { state: clone(state), locals: clone(locals) };
    const log: LogEntry[] = [];
    runActions(doc, sysId, r.contract.defaults[evName], draft, id, payload, log);
    runActions(doc, sysId, (b.on || {})[evName], draft, id, payload, log);
    setState(draft.state);
    setLocals(draft.locals);
    onState?.(draft.state);
  }

  function renderBlock(id: string, seen: Record<string, boolean>): React.ReactNode {
    if (seen[id]) return React.createElement(MissingBox, { key: id, id, msg: "slot cycle" });
    const b = doc.blocks[id];
    if (!b) return React.createElement(MissingBox, { key: id, id, msg: "no such block" });
    const r = resolve(sysId, b.type);
    if (!r.contract) return React.createElement(MissingBox, { key: id, id, msg: r.error });
    const c = r.contract;
    const sub = merge(ctx, { self: id });
    if (b.visible !== undefined && !evaluate(b.visible, sub)) return null;

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

    const Impl = (kages as Bundle)[exportName(r.ref)] as Impl | undefined;
    if (!Impl) return React.createElement(MissingBox, { key: id, id, msg: `no implementation ${exportName(r.ref)}` });
    return React.createElement(
      "div",
      { key: id, className: "kg-block", "data-block": id, "data-type": r.ref, style: { display: "contents" } },
      React.createElement(Impl, props),
    );
  }

  return React.createElement(
    "div",
    { className: ["kg-kage", sys.className, className].filter(Boolean).join(" "), "data-system": sysId + "@" + sys.version },
    renderBlock(doc.root, {}),
  );
}
