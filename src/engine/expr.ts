// The Kages expression language: a closed set of declarative operators, pure and
// synchronous. Ported from the oracle bundle. No string is ever executed as
// code; getPath reads own enumerable keys only (hasOwnProperty), so prototype
// keys resolve to undefined and no expression can reach window or prototypes.
// See oracle/expressions.feature.

import { COMPUTE_OPERATORS, computeExpression } from "./advanced.js";
import type { Expr, EvalContext, Json } from "./types.ts";

export const OPERATORS = [
  "$state", "$block", "$self", "$event", "$data", "$item",
  "$not", "$eq", "$neq", "$and", "$or", "$if", "$tpl",
  "$filter", "$count", "$sum", "$find", "$map", ...COMPUTE_OPERATORS,
] as const;

export type Operator = (typeof OPERATORS)[number];

const OPS: readonly string[] = OPERATORS;
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

type Any = any; // the reference engine is dynamically typed; mirror it internally

/** Read a dot path across own enumerable keys only; undefined on any miss,
 *  never throws, never walks the prototype chain. This is THE guard that makes
 *  expressions safe to evaluate on untrusted documents: a Kage is agent- or
 *  user-authored data, and a crafted path like "__proto__.polluted" or
 *  "constructor.prototype" must resolve to undefined, not reach Object's
 *  prototype. The hasOwnProperty check already excludes inherited keys (they
 *  are never own), so FORBIDDEN is belt-and-suspenders — it makes the intent
 *  legible and survives a future refactor that loosens the own-key check. */
export function getPath(obj: Any, path: Any): Any {
  if (path == null || path === "") return obj;
  const ps = String(path).split(".");
  for (let i = 0; i < ps.length; i++) {
    if (FORBIDDEN.has(ps[i])) return undefined;
    // Own enumerable keys only: inherited/prototype keys report hasOwnProperty
    // === false and so resolve to undefined, closing the prototype escape.
    if (obj == null || typeof obj !== "object" || !Object.prototype.hasOwnProperty.call(obj, ps[i])) return undefined;
    obj = obj[ps[i]];
  }
  return obj;
}

/** Write a dot path, refusing prototype keys outright. The read guard above is
 *  passive (a bad key just misses); a write is active and must bail before
 *  touching anything — a single "__proto__" segment would otherwise pollute
 *  Object.prototype for the whole process. Mutates obj, so it is only ever
 *  called on a cloned draft inside an action transaction, never on the doc. */
export function setPath(obj: Any, path: Any, val: Any): void {
  const ps = String(path).split(".");
  if (ps.some((k) => FORBIDDEN.has(k))) return;
  let o = obj;
  for (let i = 0; i < ps.length - 1; i++) {
    // Own keys only: an inherited object such as `toString` is not part of the
    // state tree, and walking into one would write onto a shared builtin.
    if (!Object.prototype.hasOwnProperty.call(o, ps[i]) || o[ps[i]] == null || typeof o[ps[i]] !== "object") o[ps[i]] = {};
    o = o[ps[i]];
  }
  o[ps[ps.length - 1]] = val;
}

export function clone<T>(x: T): T {
  return x == null ? x : JSON.parse(JSON.stringify(x));
}

/** Shallow combine, right wins. The reference's `merge`. */
export function merge<A, B>(a: A, b: B): A & B {
  return { ...a, ...b };
}

/** True when a value is an operator expression (first key is an operator). */
export function isExpr(x: Any): boolean {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const ks = Object.keys(x);
  return ks.length >= 1 && OPS.indexOf(ks[0]) >= 0;
}

export function operatorOf(x: Expr): Operator | null {
  return isExpr(x) ? (Object.keys(x as object)[0] as Operator) : null;
}

/** Thrown when one evaluation does too much work. A document is untrusted and nested
 *  `$map`s multiply: four levels over 1,000 items is 10^12 evaluations from a few KB. */
export class EvalBudgetError extends Error {}

/** Work allowed per top-level evaluate call, roughly 200ms. */
export const MAX_EVAL_STEPS = 2_000_000;
/** Work allowed across a whole document or operation. Without it a 1 MB document could
 *  repeat a just-under-budget expression in every block. */
export const MAX_DOCUMENT_EVAL_STEPS = 20_000_000;

// Module state, not a context field: every internal call site, including
// computeExpression and output(), must share one count, and evaluation is synchronous.
let left = 0;
let evaluating = false;
let shared = false;

function charge(cost: number): void {
  left -= cost;
  if (left < 0) throw new EvalBudgetError("expression does too much work: simplify nested $map or filter fewer rows");
}

/** Run fn with one budget shared by every evaluate inside it. A nested call joins the
 *  outer budget, so a validate inside an operation cannot refill it. */
export function withEvalBudget<T>(steps: number, fn: () => T): T {
  if (shared) return fn();
  shared = true;
  left = steps;
  try { return fn(); } finally { shared = false; }
}

/** Evaluate an expression against a context. Pure, apart from the work count.
 *  Throws EvalBudgetError when the budget runs out; callers treat it like any other
 *  per-block failure, so the worst case stays an error box rather than a hang. */
export function evaluate(x: Any, ctx: EvalContext): Any {
  if (!x || typeof x !== "object") return x;
  if (evaluating) return step(x, ctx);
  if (!shared) left = MAX_EVAL_STEPS;
  evaluating = true;
  try { return step(x, ctx); } finally { evaluating = false; }
}

function step(x: Any, ctx: EvalContext): Any {
  if (!x || typeof x !== "object") return x;
  charge(1);
  if (Array.isArray(x)) return x.map((v) => step(v, ctx));
  if (!isExpr(x)) {
    const o: Record<string, Json> = {};
    for (const k in x) o[k] = step(x[k], ctx);
    return o;
  }
  const out = operate(x, ctx);
  // Results can be far larger than the work that made them: $join and $tpl stringify
  // whole lists, so size counts too, at one step per 64 characters.
  if (typeof out === "string") charge(out.length >> 6);
  else if (Array.isArray(out)) charge(out.length);
  return out;
}

const seq = (l: Any) => { if (Array.isArray(l)) charge(l.length); return l; };

function operate(x: Any, ctx: EvalContext): Any {
  const evaluate = step;
  const op = Object.keys(x)[0];
  const a = x[op];
  if (COMPUTE_OPERATORS.includes(op)) return computeExpression(op, a, ctx, step, getPath);
  switch (op) {
    case "$state": return getPath(ctx.state, a);
    case "$block": {
      const dot = a.indexOf(".");
      const id = dot < 0 ? a : a.slice(0, dot);
      const key = dot < 0 ? "" : a.slice(dot + 1);
      return getPath(ctx.output ? ctx.output(id) : undefined, key);
    }
    case "$self": return getPath(ctx.self && ctx.output ? ctx.output(ctx.self) : undefined, a);
    case "$event": return getPath(ctx.event, a);
    case "$data": return getPath(ctx.data, a);
    case "$item": return getPath(ctx.item, a);
    case "$not": return !evaluate(a, ctx);
    case "$eq": return evaluate(a[0], ctx) === evaluate(a[1], ctx);
    case "$neq": return evaluate(a[0], ctx) !== evaluate(a[1], ctx);
    // Defensive: a malformed arg (e.g. {"$and": 1}) must not throw — the
    // architecture promises a validated doc never crashes a renderer, and we
    // uphold it even for an invalid one. validate() still reports the mistake.
    case "$and": return (Array.isArray(a) ? a : []).every((v: Any) => !!evaluate(v, ctx));
    case "$or": return (Array.isArray(a) ? a : []).some((v: Any) => !!evaluate(v, ctx));
    case "$if": return evaluate(a[0], ctx) ? evaluate(a[1], ctx) : evaluate(a[2], ctx);
    case "$tpl":
      // "Region: {{state.region}}" — each hole is a namespace + dot path that we
      // rebuild into the matching operator ({{state.x}} -> {$state:"x"}) and
      // evaluate. The regex REQUIRES the dot (ns.path), so a bare "{{state}}"
      // is left as literal text, not a lookup. Objects are JSON-stringified so
      // interpolating a row list into a prompt is well-defined; null/undefined
      // collapse to "" rather than the string "null".
      return String(a).replace(/\{\{\s*([a-zA-Z]+)\.([^}\s]+)\s*\}\}/g, (_m, ns, p) => {
        const e: Record<string, Json> = {};
        e["$" + ns] = p;
        const v = evaluate(e, ctx);
        return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      });
    case "$filter": {
      // Two independent tests, either optional: an equality on `field` and a
      // case-insensitive substring over `fields`. The interesting one is
      // `skipIf`: when the compared value equals skipIf (e.g. region === "all")
      // the equality test is DISABLED, not evaluated to false — that is how a
      // "show everything" option bound to $state turns the filter off without
      // the agent special-casing it. `eq != null` likewise treats an absent
      // filter value as "no filter", so an uninitialised $state never empties
      // the table.
      const list = seq(evaluate(a.list, ctx)) || [];
      const eq = evaluate(a.equals, ctx);
      const skip = a.skipIf !== undefined ? evaluate(a.skipIf, ctx) : undefined;
      const q = a.contains !== undefined ? String(evaluate(a.contains, ctx) || "").toLowerCase() : null;
      return list.filter((r: Any) => {
        if (a.equals !== undefined && !(skip !== undefined && eq === skip) && eq != null && getPath(r, a.field) !== eq) return false;
        if (q) {
          const hay = (a.fields || [a.field]).map((f: Any) => String(getPath(r, f) || "")).join(" ").toLowerCase();
          if (hay.indexOf(q) < 0) return false;
        }
        return true;
      });
    }
    case "$count": {
      const l = evaluate(a, ctx);
      return Array.isArray(l) ? l.length : 0;
    }
    case "$sum": {
      const l2 = seq(evaluate(a[0], ctx)) || [];
      return l2.reduce((s: number, r: Any) => s + (Number(getPath(r, a[1])) || 0), 0);
    }
    case "$find": {
      const l3 = seq(evaluate(a.list, ctx)) || [];
      const v3 = evaluate(a.equals, ctx);
      for (let i = 0; i < l3.length; i++) if (getPath(l3[i], a.field) === v3) return l3[i];
      return null;
    }
    case "$map": {
      const l4 = evaluate(a.list, ctx) || [];
      return l4.map((it: Any) => evaluate(a.to, merge(ctx, { item: it })));
    }
  }
  return undefined;
}

/** Visit every operator expression within a value, calling fn(op, arg). */
export function walkExpr(x: Any, fn: (op: string, arg: Any) => void): void {
  if (Array.isArray(x)) {
    x.forEach((v) => walkExpr(v, fn));
    return;
  }
  if (!x || typeof x !== "object") return;
  if (isExpr(x)) fn(Object.keys(x)[0], x[Object.keys(x)[0]]);
  if (Object.keys(x)[0] === "$literal") return;
  for (const k in x) walkExpr(x[k], fn);
}
