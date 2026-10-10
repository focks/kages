// Framework-free runtime pieces shared by describe() and the React renderer:
// initial local state, the evaluation context (block output resolution with a
// cycle guard), and the action dispatcher. Ported from the oracle.
// See oracle/actions-runtime.feature.

import { resolve, systemOf } from "./resolve.ts";
import { evaluate, getPath, setPath, isExpr, merge } from "./expr.ts";
import type { KageDoc, Action, Json, EvalContext } from "./types.ts";

type Any = any;

/** Seed each block's local state from contract defaults, overridden by literal props. */
export function initLocals(doc: KageDoc, sysId: string): Record<string, Record<string, Json>> {
  const L: Record<string, Record<string, Json>> = {};
  Object.keys(doc.blocks || {}).forEach((id) => {
    const b = doc.blocks[id];
    const r = resolve(sysId, b.type);
    if (!r.contract) return;
    const loc: Record<string, Json> = {};
    for (const k in r.contract.local) loc[k] = r.contract.local[k].default ?? null;
    if (b.props) for (const k2 in r.contract.local) if (b.props[k2] !== undefined && !isExpr(b.props[k2])) loc[k2] = b.props[k2];
    L[id] = loc;
  });
  return L;
}

export interface RuntimeCtx extends EvalContext {
  state: Record<string, Json>;
  data: Record<string, Json>;
  locals: Record<string, Record<string, Json>>;
  output: (id: string) => Record<string, Json> | undefined;
}

/** Build the evaluation context. The heart is `output(id)`, which computes a
 *  block's public outputs on demand and memoises them. It is a lazy dependency
 *  graph: $block references pull neighbours' outputs, which pull theirs, and so
 *  on. The `busy` set is the cycle guard — if resolving a block re-enters
 *  itself (a → b → a), we throw "Reference cycle through block 'x'" rather than
 *  recurse until the stack blows. validate() catches these statically, but the
 *  runtime must stay safe even if an unvalidated doc is rendered, because the
 *  architectural invariant is "a validated doc never throws; worst case a
 *  per-block error box" — the box needs this throw to catch. */
export function makeCtx(
  doc: KageDoc,
  sysId: string,
  state: Record<string, Json>,
  locals: Record<string, Record<string, Json>>,
): RuntimeCtx {
  const cache: Record<string, Any> = {};
  const busy: Record<string, boolean> = {};
  const ctx = { state, data: doc.data || {}, locals } as RuntimeCtx;
  ctx.output = function (id: string) {
    if (cache[id]) return cache[id];
    if (busy[id]) throw new Error("Reference cycle through block '" + id + "'");
    const b = (doc.blocks || {})[id];
    if (!b) return undefined;
    const r = resolve(sysId, b.type);
    if (!r.contract) return undefined;
    busy[id] = true;
    const out: Record<string, Any> = {};
    const c = r.contract;
    const sub = merge(ctx, { self: id });
    // Output precedence, lowest to highest (each layer overwrites the last):
    //   1. contract prop defaults
    //   2. local state (its live value; a literal prop already seeded it)
    //   3. literal props + the active system's x.<sys> extension props
    //   4. bind (expressions, re-evaluated every render — dynamic always wins)
    // The guard in step 3 skips a literal that only seeds local state, so a
    // one-off `props.value` does not shadow the running local value.
    for (const k in c.props) if (c.props[k].default !== undefined) out[k] = c.props[k].default;
    for (const k1 in c.local) out[k1] = locals[id] ? locals[id][k1] : c.local[k1].default;
    const own = b.props ? merge(b.props, (b.props.x && (b.props.x as Any)[sysId]) || {}) : null;
    if (own) for (const k2 in own) { if (k2 === "x" || (c.local[k2] && !isExpr((own as Any)[k2]))) continue; out[k2] = evaluate((own as Any)[k2], sub); }
    if (b.bind) for (const k3 in b.bind) out[k3] = evaluate(b.bind[k3], sub);
    busy[id] = false;
    cache[id] = out;
    return out;
  };
  return ctx;
}

export interface LogEntry { level: "info" | "error"; msg: string; }
export interface Draft { state: Record<string, Json>; locals: Record<string, Record<string, Json>>; }

/** A host action deferred for after-commit execution: the action plus its
 *  arguments already evaluated in the committing context. The live renderer runs
 *  these through the HostBridge; a headless caller (no onHost) gets the mock. */
export interface HostTask { action: Action; prompt?: Json; input?: Json; args: Json; }

export interface RunOptions {
  /** When set, ask/agent/fetch/emit are DEFERRED (pendingInto is set true in the
   *  commit) and handed to onHost to run asynchronously, rather than synchronously
   *  writing their mock. Omit it for previews/tests, which keep the mock path. */
  onHost?: (task: HostTask) => void;
}

/** Run a list of actions against a draft, in order, as one transaction. The
 *  caller clones state+locals into `draft`, we apply every action onto that
 *  draft (so a later action sees an earlier action's writes), and only the
 *  caller commits — a handler that throws halfway leaves the real state
 *  untouched. Host actions (ask/agent/fetch/emit) are async: with `onHost` they
 *  are deferred to run after commit; without it they log + write their `mock`
 *  (for previews and tests). Mutates draft. */
export function runActions(
  doc: KageDoc,
  sysId: string,
  actions: Action[] | Action | undefined,
  draft: Draft,
  self: string,
  event: Json,
  log: LogEntry[],
  depth?: number,
  opts?: RunOptions,
): void {
  if (!actions) return;
  // Loop guard: a command can `call` another block's command, which can call
  // back. 8 is deeper than any real UI needs; past it we assume a cycle and bail
  // rather than overflow the stack.
  if ((depth || 0) > 8) { log.push({ level: "error", msg: "Action depth > 8 (loop?)" }); return; }
  (Array.isArray(actions) ? actions : [actions]).forEach((a) => {
    const ctx = merge(makeCtx(doc, sysId, draft.state, draft.locals), { self, event });
    if (a.when !== undefined && !evaluate(a.when, ctx)) return;
    switch (a.do) {
      case "set": setPath(draft.state, a.path, evaluate(a.value, ctx)); break;
      case "toggle": setPath(draft.state, a.path, !getPath(draft.state, a.path)); break;
      case "setLocal": {
        const tgt = a.target && a.target !== "$self" ? a.target : self;
        draft.locals[tgt] = draft.locals[tgt] || {};
        draft.locals[tgt][a.key as string] = evaluate(a.value, ctx);
        break;
      }
      case "call": {
        const tid = a.target === "$self" ? self : (a.target as string);
        const tb = doc.blocks[tid];
        if (!tb) { log.push({ level: "error", msg: "call: no block '" + tid + "'" }); break; }
        const tr = resolve(sysId, tb.type);
        const cmd = tr.contract && tr.contract.commands[a.command as string];
        if (!cmd) { log.push({ level: "error", msg: "call: " + tid + " has no command '" + a.command + "'" }); break; }
        runActions(doc, sysId, cmd, draft, tid, evaluate(a.args || {}, ctx), log, (depth || 0) + 1, opts);
        break;
      }
      case "log": log.push({ level: "info", msg: String(evaluate(a.message, ctx)) }); break;
      case "ask": case "agent": case "fetch": case "emit":
        if (opts?.onHost) {
          // Defer: mark pending now (shows in the commit), run through the bridge
          // after commit. Evaluate the args here, while this context is live.
          if (a.pendingInto) setPath(draft.state, a.pendingInto, true);
          opts.onHost({ action: a, prompt: a.prompt !== undefined ? evaluate(a.prompt, ctx) : undefined, input: a.input !== undefined ? evaluate(a.input, ctx) : undefined, args: evaluate(a.args || {}, ctx) });
        } else {
          log.push({ level: "info", msg: a.do + " → host (" + JSON.stringify(evaluate(a.args || {}, ctx)) + ")" });
          if (a.into) setPath(draft.state, a.into, evaluate(a.mock !== undefined ? a.mock : null, ctx));
        }
        break;
      default: log.push({ level: "error", msg: "Unknown action '" + a.do + "'" });
    }
  });
}

export const ACTIONS = ["set", "toggle", "setLocal", "call", "log", "ask", "agent", "fetch", "emit"];

export { systemOf };
