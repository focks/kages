// describe(): a text view of a Kage for agents that cannot see pixels. Lists the
// tree, what each block shows now, and the wiring (reads / writes / calls).
// Ported from the oracle. See oracle/agent-access.feature.

import { systems } from "./data.ts";
import { resolve } from "./resolve.ts";
import { evaluate, clone, merge, walkExpr } from "./expr.ts";
import { initLocals, makeCtx, systemOf } from "./runtime-core.ts";
import type { KageDoc, Block, Json } from "./types.ts";

type Any = any;

export function describe(doc: KageDoc, override?: string, stateOverride?: Record<string, Json>): string {
  const sysId = systemOf(doc, override);
  const blocks = doc.blocks || {};
  const lines: string[] = [];
  const state = stateOverride || clone(doc.state || {});
  const locals = initLocals(doc, sysId);
  const ctx = makeCtx(doc, sysId, state, locals);

  lines.push('Kage "' + (doc.title || doc.id) + '" · system ' + sysId + (systems[sysId] ? "@" + systems[sysId].version : "") + " · " + Object.keys(blocks).length + " blocks");
  lines.push("state " + JSON.stringify(state));

  const short = (v: Any) => { const t = JSON.stringify(v); return t && t.length > 60 ? t.slice(0, 57) + "…" : t; };

  function wiring(b: Block): string {
    const reads: string[] = [], writes: string[] = [], calls: string[] = [];
    walkExpr([b.props, b.bind, b.visible], (op, arg) => {
      if (op === "$state" || op === "$block" || op === "$data") { const rd = op.slice(1) + ":" + arg; if (reads.indexOf(rd) < 0) reads.push(rd); }
    });
    Object.keys(b.on || {}).forEach((ev) => (b.on![ev] || []).forEach((a) => {
      if (a.do === "set" || a.do === "toggle") writes.push(ev + "→state." + a.path);
      if (a.do === "call") calls.push(ev + "→" + a.target + "." + a.command);
      if (a.do === "ask" || a.do === "agent" || a.do === "fetch" || a.do === "emit") calls.push(ev + "→" + a.do + (a.agent ? ":" + a.agent : "") + (a.into ? "⇒state." + a.into : ""));
    }));
    const w: string[] = [];
    if (reads.length) w.push("reads " + reads.join(", "));
    if (writes.length) w.push("writes " + writes.join(", "));
    if (calls.length) w.push("calls " + calls.join(", "));
    return w.join(" · ");
  }

  function walk(id: string, depth: number, seen: Record<string, boolean>): void {
    const pad = new Array(depth + 1).join("  ");
    const b = blocks[id];
    if (!b || seen[id]) { lines.push(pad + "- " + id + " (missing)"); return; }
    seen[id] = true;
    const r = resolve(sysId, b.type);
    let shown = true;
    if (b.visible !== undefined) { try { shown = !!evaluate(b.visible, merge(ctx, { self: id })); } catch { shown = false; } }
    const head = pad + "- " + id + " [" + (r.ref || b.type) + "]" + (shown ? "" : " (hidden)");
    let out: Any = {};
    try { out = ctx.output(id) || {}; } catch { /* cycle */ }
    const keys = ["title", "label", "text", "value", "collapsed", "subtitle"].filter((k) => out[k] !== undefined && out[k] !== null && out[k] !== "");
    if (out.rows) keys.push("rows");
    const facts = keys.map((k) => (k === "rows" ? "rows=" + out.rows.length : k + "=" + short(out[k])));
    if (out.items) facts.push("items=" + out.items.map((i: Any) => i.id).join("|"));
    if (out.options) facts.push("options=" + out.options.map((o: Any) => o.value).join("|"));
    lines.push(head + (facts.length ? " " + facts.join(" ") : ""));
    const wr = wiring(b);
    if (wr) lines.push(pad + "    ↳ " + wr);
    const c = r.contract;
    if (!c) return;
    Object.keys(c.slots).forEach((sl) => {
      const kids = (b.slots || {})[sl] || [];
      if (kids.length && Object.keys(c.slots).length > 1) lines.push(pad + "  " + sl + ":");
      kids.forEach((k) => walk(k, depth + (Object.keys(c.slots).length > 1 ? 2 : 1), seen));
    });
  }
  walk(doc.root, 0, {});
  return lines.join("\n");
}
