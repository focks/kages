// validate(doc, system?) → {ok, errors, warnings, system, portable}. Every
// finding is {at: <JSON pointer>, code, msg}. Ported from the oracle; a document
// that passes validate() never throws in any renderer. See oracle/validator.feature.

import { systems, interfaces } from "./data.ts";
import { resolve, systemOf } from "./resolve.ts";
import { isExpr, walkExpr, getPath } from "./expr.ts";
import { ACTIONS } from "./runtime-core.ts";
import type { KageDoc, Finding, ValidateResult, PropSpec, ResolveOk } from "./types.ts";

type Any = any;

function typeOk(spec: PropSpec, v: Any): boolean {
  if (v === undefined || v === null || !spec || !spec.type) return true;
  return spec.type.split("|").some((t) =>
    t === "array" ? Array.isArray(v) : t === "object" ? typeof v === "object" && !Array.isArray(v) : typeof v === t,
  );
}

export function validate(doc: KageDoc, override?: string): ValidateResult {
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  const sysId = systemOf(doc, override);
  const blocks = doc.blocks || {};
  const E = (at: string, code: string, msg: string) => errors.push({ at, code, msg });
  const Wn = (at: string, code: string, msg: string) => warnings.push({ at, code, msg });

  if (!doc.kages) Wn("/", "no-version", "Missing `kages` document version");
  if (!systems[sysId]) {
    E("/system", "unknown-system", "Unknown design system " + sysId);
    return { ok: false, errors, warnings, system: sysId };
  }
  if (!blocks[doc.root]) E("/root", "missing-root", "root '" + doc.root + "' is not a block");

  const parent: Record<string, string> = {};
  const resolved: Record<string, ResolveOk> = {};

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
        if (!blocks[cid]) E(at + "/slots/" + sl, "missing-child", "no block '" + cid + "'");
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
    walkExpr([b.props, b.bind, b.visible, b.on], (op, arg) => {
      if (op === "$block") {
        const tid = String(arg).split(".")[0];
        const key = String(arg).split(".")[1];
        if (!blocks[tid]) E(at, "dangling-ref", "$block '" + arg + "': no block '" + tid + "'");
        else if (resolved[tid] && key && resolved[tid].contract.outputs.indexOf(key) < 0)
          E(at, "private-output", "$block '" + arg + "': " + resolved[tid].contract.ref + " outputs only " + (resolved[tid].contract.outputs.join(", ") || "nothing"));
      }
      if (op === "$state" && doc.state && getPath(doc.state, String(arg).split(".")[0]) === undefined) Wn(at, "undeclared-state", "$state '" + arg + "' is not declared in `state`");
      if (op === "$data" && getPath(doc.data || {}, String(arg).split(".")[0]) === undefined) E(at, "missing-data", "$data '" + arg + "' is not in `data`");
    });
    Object.keys(b.on || {}).forEach((ev) => {
      (b.on![ev] || []).forEach((a, i) => {
        const aat = at + "/on/" + ev + "/" + i;
        if (ACTIONS.indexOf(a.do) < 0) E(aat, "unknown-action", "Unknown action `" + a.do + "`");
        if ((a.do === "set" || a.do === "toggle") && doc.state && getPath(doc.state, String(a.path).split(".")[0]) === undefined) Wn(aat, "undeclared-state", "writes undeclared state '" + a.path + "'");
        if (a.do === "ask" && (!a.prompt || !a.into)) E(aat, "missing-field", "`ask` needs `prompt` and `into`");
        if (a.do === "agent" && (!a.agent || !a.into)) E(aat, "missing-field", "`agent` needs `agent` (a registered agent id) and `into`");
        if (a.do === "fetch" && a.source && !(doc.sources || {})[a.source]) E(aat, "missing-source", "`fetch` names source '" + a.source + "', which is not in `sources`");
        if (a.do === "setLocal") E(aat, "foreign-local", "Blocks change another block's local state only through its commands (`call`)");
        if (a.do === "call") {
          const t = a.target === "$self" ? id : (a.target as string);
          if (!blocks[t]) E(aat, "dangling-ref", "call target '" + t + "' does not exist");
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
  const color: Record<string, number> = {};
  function dfs(id: string, path: string[]): void {
    if (color[id] === 1) { E("/blocks/" + id, "ref-cycle", "reference cycle: " + path.concat(id).join(" → ")); return; }
    if (color[id] === 2 || !blocks[id]) return;
    color[id] = 1;
    walkExpr([blocks[id].props, blocks[id].bind], (op, arg) => { if (op === "$block") dfs(String(arg).split(".")[0], path.concat(id)); });
    color[id] = 2;
  }
  Object.keys(blocks).forEach((id) => dfs(id, []));
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
