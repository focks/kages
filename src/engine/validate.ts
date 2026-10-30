// validate(doc, system?) → {ok, errors, warnings, system, portable}. Every
// finding is {at: <JSON pointer>, code, msg}. Ported from the oracle; a document
// that passes validate() never throws in any renderer. See oracle/validator.feature.

import { advancedFindings } from "./advanced.js";
import { materialize, initLocals, makeCtx } from "./runtime-core.ts";
import { systems, interfaces } from "./data.ts";
import { resolve, systemOf } from "./resolve.ts";
import { isExpr, walkExpr, getPath, withEvalBudget, EvalBudgetError, MAX_DOCUMENT_EVAL_STEPS } from "./expr.ts";
import { ACTIONS } from "./runtime-core.ts";
import type { KageDoc, Finding, ValidateResult, PropSpec, ResolveOk } from "./types.ts";

type Any = any;

function typeOk(spec: PropSpec, v: Any): boolean {
  if (v === undefined || v === null || !spec || !spec.type) return true;
  return spec.type.split("|").some((t) =>
    t === "array" ? Array.isArray(v) : t === "object" ? typeof v === "object" && !Array.isArray(v) : typeof v === t,
  );
}

const isObj = (v: Any) => v != null && typeof v === "object" && !Array.isArray(v);

/** The shape each operator's argument must have. Returns a message for a
 *  malformed one, or null. Only flags clear violations, so valid documents stay
 *  clean. */
function badExprArg(op: string, arg: Any): string | null {
  switch (op) {
    case "$and": case "$or": return Array.isArray(arg) ? null : `${op} takes an array of conditions`;
    case "$eq": case "$neq": return Array.isArray(arg) && arg.length === 2 ? null : `${op} takes [a, b]`;
    case "$if": return Array.isArray(arg) && (arg.length === 2 || arg.length === 3) ? null : "$if takes [cond, then, else?]";
    case "$sum": return Array.isArray(arg) && arg.length === 2 ? null : "$sum takes [list, field]";
    case "$filter": case "$find": case "$map": return isObj(arg) && "list" in arg ? null : `${op} takes { list, … }`;
    case "$tpl": return typeof arg === "string" ? null : "$tpl takes a template string";
    case "$state": case "$block": case "$self": case "$event": case "$data": case "$item":
      return typeof arg === "string" ? null : `${op} takes a path string`;
    default: return null; // $not, $count accept any value
  }
}

/** The shape every later pass assumes. Those passes dereference blocks, slots and
 *  handlers freely, so a wrong shape used to surface as a raw TypeError with code
 *  `internal`, from the very tool meant to explain bad documents. */
function shapeFindings(doc: KageDoc): Finding[] {
  const out: Finding[] = [];
  const bad = (at: string, msg: string) => out.push({ at, code: "bad-shape", msg });
  if (!isObj(doc)) { bad("/", "A Kage is a JSON object"); return out; }
  if (!isObj(doc.blocks)) { bad("/blocks", "`blocks` maps block ids to block objects"); return out; }
  for (const [id, block] of Object.entries(doc.blocks)) {
    const at = "/blocks/" + id;
    if (!isObj(block)) { bad(at, "A block is an object with a `type`"); continue; }
    const b = block as Any;
    if (typeof b.type !== "string") bad(at + "/type", "`type` is a string, such as \"text\"");
    for (const key of ["props", "bind"]) if (b[key] !== undefined && !isObj(b[key])) bad(at + "/" + key, "`" + key + "` is an object");
    if (b.slots !== undefined) {
      if (!isObj(b.slots)) bad(at + "/slots", "`slots` maps a slot name to a list of block ids");
      else for (const [slot, ids] of Object.entries(b.slots)) if (!Array.isArray(ids)) bad(at + "/slots/" + slot, "A slot is a list of block ids, such as [\"intro\"]");
    }
    if (b.on !== undefined) {
      if (!isObj(b.on)) bad(at + "/on", "`on` maps an event name to a list of actions");
      else for (const [event, list] of Object.entries(b.on)) {
        if (!Array.isArray(list)) bad(at + "/on/" + event, "A handler is a list of actions, such as [{\"do\":\"set\",\"path\":\"x\",\"value\":1}]");
        else list.forEach((action, i) => { if (!isObj(action)) bad(at + "/on/" + event + "/" + i, "An action is an object with `do`"); });
      }
    }
  }
  return out;
}

// Same characters the store's refs and CLI file names can carry. A Kage's id is its
// name in every later call, so one that is missing or holds a path separator creates
// a Kage nothing can fetch, patch or publish.
const KAGE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const BLOCK_KEYS = new Set(["type", "props", "bind", "slots", "on", "watch", "visible", "repeat", "meta"]);
const DOC_KEYS = new Set(["kages", "id", "title", "system", "root", "blocks", "state", "persist", "data", "sources", "compositions", "design", "resolved", "brief", "meta", "description"]);

function unknownOperators(x: Any, at: string, warn: (at: string, code: string, msg: string) => void): void {
  if (Array.isArray(x)) { x.forEach((v, i) => unknownOperators(v, at + "/" + i, warn)); return; }
  if (!isObj(x)) return;
  const keys = Object.keys(x);
  if (keys.length === 1 && keys[0][0] === "$" && !isExpr(x)) warn(at, "unknown-operator", "`" + keys[0] + "` is not an operator, so this value will be treated as plain data");
  if (keys[0] === "$literal") return;
  for (const k of keys) unknownOperators(x[k], at + "/" + k, warn);
}

/** Mistakes that do nothing at runtime and so would only be found by reading the
 *  render. Warnings, not errors: stored documents must stay writable. */
function authoringWarnings(doc: KageDoc, system: string): Finding[] {
  const out: Finding[] = [];
  const warn = (at: string, code: string, msg: string) => out.push({ at, code, msg });
  for (const k of Object.keys(doc)) if (!DOC_KEYS.has(k)) warn("/" + k, "unknown-key", "A Kage has no `" + k + "` field (it will be ignored)");
  for (const [id, b] of Object.entries(doc.blocks) as [string, Any][]) {
    const at = "/blocks/" + id;
    for (const k of Object.keys(b)) if (!BLOCK_KEYS.has(k)) warn(at + "/" + k, "unknown-key", "A block has no `" + k + "` field (it will be ignored)");
    unknownOperators(b.props, at + "/props", warn);
    unknownOperators(b.bind, at + "/bind", warn);
    unknownOperators(b.visible, at + "/visible", warn);
    const contract = resolve(system, b.type).contract;
    for (const [key, spec] of Object.entries(contract?.props ?? {})) {
      const items = (b.props ?? {})[key];
      if (!spec.items || !Array.isArray(items) || isExpr(items)) continue;
      items.forEach((item: Any, i: number) => {
        if (isExpr(item)) return;
        if (spec.items!.type && !typeOk(spec.items as PropSpec, item)) warn(at + "/props/" + key + "/" + i, "item-shape", "`" + key + "` items should be " + spec.items!.type);
      });
    }
    for (const [event, list] of Object.entries(b.on ?? {}) as [string, Any[]][]) list.forEach((a, i) => {
      if (a.do === "set" && !("value" in a)) warn(at + "/on/" + event + "/" + i, "set-without-value", "`set` has no `value`, so it writes undefined");
    });
  }
  return out;
}

function validateBase(doc: KageDoc, override?: string): ValidateResult {
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  const sysId = systemOf(doc, override);
  const blocks = doc.blocks || {};
  const E = (at: string, code: string, msg: string) => errors.push({ at, code, msg });
  const Wn = (at: string, code: string, msg: string) => warnings.push({ at, code, msg });
  // Own keys only, throughout: `{$block:"__proto__"}` or a slot naming "constructor"
  // must read as a missing block, not resolve to something inherited.
  const has = (id: string) => Object.prototype.hasOwnProperty.call(blocks, id);

  if (!doc.kages) Wn("/", "no-version", "Missing `kages` document version");
  if (!systems[sysId]) {
    E("/system", "unknown-system", "Unknown design system " + sysId);
    return { ok: false, errors, warnings, system: sysId };
  }
  if (!has(doc.root)) E("/root", "missing-root", "root '" + doc.root + "' is not a block");

  const parent: Record<string, string> = Object.create(null);
  const resolved: Record<string, ResolveOk> = Object.create(null);

  Object.keys(blocks).forEach((id) => {
    const b = blocks[id];
    const at = "/blocks/" + id;
    if (!/^[a-z][a-zA-Z0-9_-]{0,47}$/.test(id)) E(at, "bad-id", "Block ids are lowerCamel/kebab, start with a letter");
    const r = resolve(sysId, b.type);
    if (!r.contract) { E(at + "/type", "unresolved-type", r.error); return; }
    resolved[id] = r;
    const c = r.contract;

    Object.keys(c.props).forEach((k) => {
      const spec = c.props[k];
      const given = (b.props || {})[k] !== undefined || (b.bind || {})[k] !== undefined;
      if (spec.required && !given) E(at + "/props/" + k, "missing-prop", c.ref + " requires `" + k + "`");
      const v = (b.props || {})[k];
      if (v !== undefined && !isExpr(v)) {
        if (!typeOk(spec, v)) E(at + "/props/" + k, "type", "`" + k + "` should be " + spec.type);
        if (spec.enum && spec.enum.indexOf(v) < 0) E(at + "/props/" + k, "enum", "`" + k + "` must be one of " + spec.enum.join(", "));
        if (spec.items && spec.items.requiredKeys && Array.isArray(v)) {
          v.forEach((it: Any, i: number) => {
            spec.items!.requiredKeys!.forEach((rk) => {
              if (!it || it[rk] === undefined) E(at + "/props/" + k + "/" + i, "missing-key", "item needs `" + rk + "`");
            });
          });
        }
      }
    });

    const xp = ((b.props || {}).x || {}) as Record<string, Any>;
    Object.keys(xp).forEach((xs) => { if (!systems[xs]) Wn(at + "/props/x/" + xs, "unknown-system", "extension props for unknown system '" + xs + "'"); });
    Object.keys(xp[sysId] || {}).forEach((k) => {
      if (!c.props[k]) Wn(at + "/props/x/" + sysId + "/" + k, "unknown-prop", c.ref + " has no prop `" + k + "`");
      else if (!isExpr(xp[sysId][k]) && !typeOk(c.props[k], xp[sysId][k])) E(at + "/props/x/" + sysId + "/" + k, "type", "`" + k + "` should be " + c.props[k].type);
    });

    Object.keys(b.props || {}).filter((k) => k !== "x").concat(Object.keys(b.bind || {})).forEach((k) => {
      if (!c.props[k] && !c.local[k]) Wn(at + "/props/" + k, "unknown-prop", c.ref + " has no prop `" + k + "` (it will be ignored)");
    });

    if (c.limits.maxOptions && Array.isArray((b.props || {}).options) && (b.props!.options as Any[]).length > c.limits.maxOptions)
      Wn(at, "limit", c.ref + " shows at most " + c.limits.maxOptions + " options; pin core/dropdown@1 or trim");

    Object.keys(b.slots || {}).forEach((sl) => {
      if (!c.slots[sl]) E(at + "/slots/" + sl, "unknown-slot", c.ref + " has no slot `" + sl + "`");
      else if (c.slots[sl].max && b.slots![sl].length > c.slots[sl].max!) E(at + "/slots/" + sl, "slot-max", "`" + sl + "` takes at most " + c.slots[sl].max);
      (b.slots![sl] || []).forEach((cid) => {
        if (!has(cid)) E(at + "/slots/" + sl, "missing-child", "no block '" + cid + "'");
        else if (parent[cid]) E(at + "/slots/" + sl, "two-parents", "'" + cid + "' is already placed in '" + parent[cid] + "'");
        else parent[cid] = id;
      });
    });
    Object.keys(c.slots).forEach((sl) => {
      if (c.slots[sl].required && !((b.slots || {})[sl] || []).length) E(at + "/slots/" + sl, "empty-slot", "`" + sl + "` needs at least one block");
    });
    Object.keys(b.on || {}).forEach((ev) => {
      if (!c.events[ev]) E(at + "/on/" + ev, "unknown-event", c.ref + " emits no `" + ev + "` (emits: " + (Object.keys(c.events).join(", ") || "nothing") + ")");
    });
  });

  // Pass two: references and actions. This is a SEPARATE pass because a $block
  // reference or a `call` target may name a block defined later in the map, and
  // checking "is that output public?" / "does that command exist?" needs the
  // target's contract — which only exists in `resolved` after pass one has run
  // over every block. One pass would false-positive on forward references.
  Object.keys(blocks).forEach((id) => {
    const b = blocks[id];
    const at = "/blocks/" + id;
    walkExpr([b.props, b.bind, b.visible, b.on, b.watch, b.repeat?.each], (op, arg) => {
      // Operator argument shape. A malformed expression ({"$and": 1}) would
      // otherwise pass validation and then throw at render time, breaking the
      // "a validated doc never throws" invariant. Caught here so the author is
      // told, with the runtime defensive as a second line.
      const badShape = badExprArg(op, arg);
      if (badShape) E(at, "bad-expr", badShape);
      if (op === "$block") {
        const tid = String(arg).split(".")[0];
        const key = String(arg).split(".")[1];
        if (!has(tid)) E(at, "dangling-ref", "$block '" + arg + "': no block '" + tid + "'");
        else if (resolved[tid] && key && resolved[tid].contract.outputs.indexOf(key) < 0)
          E(at, "private-output", "$block '" + arg + "': " + resolved[tid].contract.ref + " outputs only " + (resolved[tid].contract.outputs.join(", ") || "nothing"));
      }
      if (op === "$state" && doc.state && getPath(doc.state, String(arg).split(".")[0]) === undefined) Wn(at, "undeclared-state", "$state '" + arg + "' is not declared in `state`");
      if (op === "$data" && getPath(doc.data || {}, String(arg).split(".")[0]) === undefined) E(at, "missing-data", "$data '" + arg + "' is not in `data`");
    });
    if (b.watch !== undefined) {
      if (!b.watch || typeof b.watch !== "object" || Array.isArray(b.watch)) E(at + "/watch", "bad-watch", "`watch` maps a state path to a list of actions");
      else for (const [path, list] of Object.entries(b.watch)) {
        const wat = at + "/watch/" + path;
        if (doc.state && getPath(doc.state, path.split(".")[0]) === undefined) Wn(wat, "undeclared-state", "watches undeclared state '" + path + "'");
        if (!Array.isArray(list)) { E(wat, "bad-watch", "`watch` maps a state path to a list of actions"); continue; }
        list.forEach((a, i) => { if (ACTIONS.indexOf(a?.do) < 0) E(wat + "/" + i, "unknown-action", "Unknown action `" + a?.do + "`"); });
      }
    }
    Object.keys(b.on || {}).forEach((ev) => {
      (b.on![ev] || []).forEach((a, i) => {
        const aat = at + "/on/" + ev + "/" + i;
        if (ACTIONS.indexOf(a.do) < 0) E(aat, "unknown-action", "Unknown action `" + a.do + "`");
        if ((a.do === "set" || a.do === "toggle") && typeof a.path !== "string" && !(a.path && typeof a.path === "object")) E(aat, "bad-path", "`" + a.do + "` needs a state path: a dot-path string or an expression that yields one");
        if ((a.do === "set" || a.do === "toggle") && typeof a.path === "string" && doc.state && getPath(doc.state, String(a.path).split(".")[0]) === undefined) Wn(aat, "undeclared-state", "writes undeclared state '" + a.path + "'");
        if (a.do === "ask" && (!a.prompt || !a.into)) E(aat, "missing-field", "`ask` needs `prompt` and `into`");
        if (a.do === "agent" && (!a.agent || !a.into)) E(aat, "missing-field", "`agent` needs `agent` (a registered agent id) and `into`");
        if (a.do === "fetch" && a.source && !(doc.sources || {})[a.source]) E(aat, "missing-source", "`fetch` names source '" + a.source + "', which is not in `sources`");
        if (a.do === "setLocal") E(aat, "foreign-local", "Blocks change another block's local state only through its commands (`call`)");
        if (a.do === "call") {
          const t = a.target === "$self" ? id : (a.target as string);
          if (!has(t)) E(aat, "dangling-ref", "call target '" + t + "' does not exist");
          else if (resolved[t] && !resolved[t].contract.commands[a.command as string]) E(aat, "unknown-command", resolved[t].contract.ref + " has no command `" + a.command + "` (has: " + (Object.keys(resolved[t].contract.commands).join(", ") || "none") + ")");
        }
      });
    });
  });

  // Reference cycles (a.bind reads b, b.bind reads a). Classic three-colour DFS:
  // 0/undefined = unseen, 1 = on the current path (grey), 2 = fully explored
  // (black). Re-entering a grey node is a back edge = a cycle; a black node is
  // already proven acyclic, so we stop without re-walking it (keeps this O(V+E)
  // on a dense reference graph instead of exponential). Catching cycles here is
  // what lets the runtime's output() memoiser trust its inputs.
  const color: Record<string, number> = Object.create(null);
  function dfs(id: string, path: string[]): void {
    if (color[id] === 1) { E("/blocks/" + id, "ref-cycle", "reference cycle: " + path.concat(id).join(" → ")); return; }
    if (color[id] === 2 || !has(id)) return;
    color[id] = 1;
    walkExpr([blocks[id].props, blocks[id].bind], (op, arg) => { if (op === "$block") dfs(String(arg).split(".")[0], path.concat(id)); });
    color[id] = 2;
  }
  Object.keys(blocks).forEach((id) => dfs(id, []));

  // Slot cycles (a contains b contains a). The renderer has a `seen` guard so it
  // won't loop, but a slot cycle means the tree isn't a tree — reject it so a
  // validated document renders as the author intends. Same three-colour DFS.
  const scolor: Record<string, number> = Object.create(null);
  function sdfs(id: string, path: string[]): void {
    if (scolor[id] === 1) { E("/blocks/" + id, "slot-cycle", "slot cycle: " + path.concat(id).join(" → ")); return; }
    if (scolor[id] === 2 || !has(id)) return;
    scolor[id] = 1;
    for (const sl of Object.keys(blocks[id].slots || {})) for (const cid of blocks[id].slots![sl] || []) sdfs(cid, path.concat(id));
    scolor[id] = 2;
  }
  Object.keys(blocks).forEach((id) => sdfs(id, []));

  Object.keys(blocks).forEach((id) => { if (id !== doc.root && !parent[id]) Wn("/blocks/" + id, "orphan", "'" + id + "' is never placed in a slot"); });

  // Portability: a Kage is portable when it would render in ANY system that
  // implements the same interfaces. Two things break that — a prop that lives
  // only in this component's contract (not in its interface), and a
  // fully-qualified `type` that pins one system's implementation. Either makes
  // "switch systems with one field" unsafe, so we report portable:false and the
  // agent can decide. x-props are allowed (they are explicitly per-system) and
  // so are skipped here.
  let portable = true;
  Object.keys(resolved).forEach((id) => {
    const c = resolved[id].contract;
    const I = interfaces[c.implements[0]];
    Object.keys(blocks[id].props || {}).forEach((k) => {
      if (k !== "x" && !I.props[k] && !(I.local || {})[k]) portable = false;
    });
    if (/\//.test(blocks[id].type)) portable = false;
  });

  return { ok: errors.length === 0, errors, warnings, system: sysId, portable };
}

/** Validate definitions even when their repeat is empty, then exercise initial
 * expansion to catch duplicate keys and recursion before a version is stored. */
export function validate(doc: KageDoc, override?: string): ValidateResult {
  const shape = shapeFindings(doc);
  if (shape.length) return { ok: false, errors: shape, warnings: [], system: isObj(doc) ? systemOf(doc, override) : override ?? "core" };
  return withEvalBudget(MAX_DOCUMENT_EVAL_STEPS, () => {
    const result = validateBase(doc, override);
    const errors = advancedFindings(doc, (d: KageDoc) => validateBase(d, override), isExpr, walkExpr, (type: string) => resolve(result.system, type).contract);
    if (result.ok && errors.length === 0) {
      try {
        const expanded = materialize(doc, result.system, doc.state || {}, initLocals(doc, result.system));
        const ctx = makeCtx(expanded, result.system, doc.state || {}, initLocals(expanded, result.system));
        for (const [id, block] of Object.entries(expanded.blocks)) if (block.type === "composition" && doc.compositions?.[String(block.props?.name)]?.outputType) ctx.output(id);
      }
      catch (e) { errors.push({ at: "/blocks", code: e instanceof EvalBudgetError ? "eval-budget" : "bad-expansion", msg: (e as Error).message }); }
    }
    return { ...result, ok: result.ok && errors.length === 0, errors: [...result.errors, ...errors] };
  });
}

/** validate(), plus what the store and agents need beyond the oracle: a usable `id`,
 *  and warnings for mistakes that silently do nothing. Separate because validate() is
 *  pinned to the oracle's goldens (the broken fixture has no id and exactly 6 errors). */
export function validateDocument(doc: KageDoc, override?: string): ValidateResult {
  const result = validate(doc, override);
  if (!isObj(doc) || !isObj(doc.blocks) || result.errors.some((e) => e.code === "bad-shape")) return result;
  const errors = [...result.errors];
  if (typeof doc.id !== "string" || !KAGE_ID.test(doc.id)) errors.push({ at: "/id", code: "bad-kage-id", msg: "`id` is the Kage's name: 1 to 128 letters, digits, dots, dashes or underscores, starting with a letter or digit" });
  const warnings = systems[result.system] ? [...result.warnings, ...authoringWarnings(doc, result.system)] : result.warnings;
  return { ...result, ok: errors.length === 0, errors, warnings };
}
