// Shared, framework-free extensions for the oracle and the pure engine. Keeping
// one implementation prevents an agent's generated formula or collection from
// validating on the server but behaving differently in the browser.
// See oracle/expressive-artifacts.feature.
export const COMPUTE_OPERATORS = ["$literal", "$index", "$scope", "$input", "$add", "$sub", "$mul", "$div", "$mod", "$pow", "$min", "$max", "$round", "$lt", "$lte", "$gt", "$gte", "$concat", "$sort", "$format", "$floor", "$ceil", "$abs", "$join", "$truncate"];
const unary = ["$floor", "$ceil", "$abs"];
const binary = ["$sub", "$div", "$mod", "$pow", "$lt", "$lte", "$gt", "$gte"];
const variadic = ["$add", "$mul", "$min", "$max", "$concat"];
const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
const object = (o) => o != null && typeof o === "object" && !Array.isArray(o);
const finite = (n) => typeof n === "number" && Number.isFinite(n);
const safeKey = (s) => typeof s === "string" && s.split(".").every(k => k && !["__proto__", "constructor", "prototype"].includes(k));

/** Malformed operator shapes are rejected before evaluation; numeric domain
 * errors yield null so NaN/Infinity never escape into document state. */
export function computationArgError(op, a) {
  if (binary.includes(op)) return Array.isArray(a) && a.length === 2 ? null : op + " takes [a, b]";
  if (variadic.includes(op)) return Array.isArray(a) && a.length > 0 ? null : op + " takes a nonempty array";
  if (unary.includes(op)) return Array.isArray(a) && a.length === 1 ? null : op + " takes [value]";
  if (op === "$join") return object(a) && own(a, "list") && (a.separator === undefined || typeof a.separator === "string" && a.separator.length <= 20) ? null : "$join takes {list, separator?}";
  if (op === "$truncate") return object(a) && own(a, "value") && (a.length === undefined || Number.isInteger(a.length) && a.length >= 0 && a.length <= 100000) && (a.suffix === undefined || typeof a.suffix === "string" && a.suffix.length <= 20) ? null : "$truncate takes {value, length?, suffix?}";
  if (op === "$round") return Array.isArray(a) && (a.length === 1 || a.length === 2) ? null : "$round takes [value, digits?]";
  if (["$scope", "$input"].includes(op)) return typeof a === "string" ? null : op + " takes a path string";
  if (op === "$index") return a === "" ? null : "$index takes an empty path string";
  if (op === "$sort") return object(a) && own(a, "list") && (a.field === undefined || typeof a.field === "string") && (a.direction === undefined || ["asc", "desc"].includes(a.direction)) ? null : "$sort takes {list, field?, direction?: asc|desc}";
  if (op === "$format") return object(a) && own(a, "value") && ["number", "currency", "percent", "date", "relative"].includes(a.style) && (a.notation === undefined || a.notation === "compact") && (a.relativeTo === undefined || typeof a.relativeTo === "string") && (a.digits === undefined || Number.isInteger(a.digits) && a.digits >= 0 && a.digits <= 10) && (a.currency === undefined || /^[A-Z]{3}$/.test(a.currency)) ? null : "$format takes {value, style: number|currency|percent|date, digits?: 0..10, currency?: ISO code}";
  return null;
}

/** The state path an action writes. A static string, or an expression (a repeated row writes to `list.<index>.field`).
 * Returns null for anything that does not produce a plain dot path, so a bad expression writes nothing. */
export function actionPath(path, ctx, evaluate) {
  if (typeof path === "string") return path;
  const v = object(path) ? evaluate(path, ctx) : null;
  return typeof v === "string" && /^[^.]+(\.[^.]+)*$/.test(v) ? v : null;
}

/** Which `watch` handlers fire after a transaction: a block lists state paths and the actions to run when that path's
 * value changed. Compared as JSON so an equal rewrite does not fire. The caller runs them on the same draft and repeats
 * a bounded number of times (a handler that keeps changing what it watches is a loop, not a feature). */
export function watchedActions(doc, before, after, getPath) {
  const out = [];
  for (const [id, b] of Object.entries(doc.blocks || {})) {
    if (!object(b.watch)) continue;
    for (const [path, actions] of Object.entries(b.watch)) {
      if (!safeKey(path) || !Array.isArray(actions)) continue;
      if (JSON.stringify(getPath(before, path) ?? null) !== JSON.stringify(getPath(after, path) ?? null)) out.push([id, actions]);
    }
  }
  return out;
}
export const WATCH_ROUNDS = 4;

/** Evaluate only closed operators; no coercive arithmetic, code, locale clock,
 * or mutable sorting. Formatting is pinned to en-US and UTC for reproducibility. */
export function computeExpression(op, a, ctx, evaluate, getPath) {
  if (computationArgError(op, a)) return null;
  if (op === "$literal") return a;
  if (op === "$index") return ctx.index ?? null;
  if (op === "$scope") return getPath(ctx.scope, a);
  if (op === "$input") return getPath(ctx.input, a);
  if (op === "$concat") return a.map(v => evaluate(v, ctx)).map(v => v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)).join("");
  if (op === "$join") {
    const list = evaluate(a.list, ctx);
    return Array.isArray(list) ? list.map(v => v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)).join(a.separator ?? ", ") : "";
  }
  if (op === "$truncate") {
    const value = evaluate(a.value, ctx), text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value), max = a.length ?? 100;
    return text.length <= max ? text : text.slice(0, max) + (a.suffix ?? "...");
  }
  if (op === "$sort") {
    const list = evaluate(a.list, ctx);
    if (!Array.isArray(list)) return [];
    return list.map((value, i) => ({ value, i, key: a.field ? getPath(value, a.field) : value })).sort((x, y) => {
      const p = x.key, q = y.key;
      if (p == null) return q == null ? x.i - y.i : 1;
      if (q == null) return -1;
      const cmp = typeof p === "number" && typeof q === "number" ? p - q : String(p) < String(q) ? -1 : String(p) > String(q) ? 1 : 0;
      return (a.direction === "desc" ? -cmp : cmp) || x.i - y.i;
    }).map(x => x.value);
  }
  if (op === "$format") {
    const value = evaluate(a.value, ctx);
    try {
      if (a.style === "relative") {
        // Relative to an explicit instant, never the clock: the same document must read the same on every render.
        const iso = /^\d{4}-\d{2}-\d{2}(?:T.*(?:Z|[+-]\d{2}:\d{2}))?$/, to = new Date(a.relativeTo ?? "");
        if (typeof value !== "string" || !iso.test(value) || typeof a.relativeTo !== "string" || !iso.test(a.relativeTo)) return null;
        const at = new Date(value), diff = to.getTime() - at.getTime();
        if (!Number.isFinite(diff)) return null;
        if (diff === 0) return "just now";
        const abs = Math.abs(diff), secs = Math.floor(abs / 1000), mins = Math.floor(secs / 60), hours = Math.floor(mins / 60), days = Math.floor(hours / 24), tail = diff > 0 ? "ago" : "from now";
        return days > 0 ? days + "d " + tail : hours > 0 ? hours + "h " + tail : mins > 0 ? mins + "m " + tail : secs + "s " + tail;
      }
      if (a.style === "date") {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
        const date = new Date(value);
        return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date) : null;
      }
      if (!finite(value)) return null;
      const opts = { style: a.style === "number" ? "decimal" : a.style, ...(a.notation === "compact" ? { notation: "compact" } : {}), ...(a.style === "currency" ? { currency: a.currency || "USD" } : {}), ...(a.digits !== undefined ? { minimumFractionDigits: a.digits, maximumFractionDigits: a.digits } : {}) };
      return new Intl.NumberFormat("en-US", opts).format(value);
    } catch { return null; }
  }
  const v = a.map(x => evaluate(x, ctx));
  if (!v.every(finite)) return null;
  let result;
  switch (op) {
    case "$add": result = v.reduce((s, n) => s + n, 0); break;
    case "$sub": result = v[0] - v[1]; break;
    case "$mul": result = v.reduce((s, n) => s * n, 1); break;
    case "$div": result = v[1] === 0 ? null : v[0] / v[1]; break;
    case "$mod": result = v[1] === 0 ? null : v[0] % v[1]; break;
    case "$pow": result = Math.pow(v[0], v[1]); break;
    case "$min": result = Math.min(...v); break;
    case "$max": result = Math.max(...v); break;
    case "$floor": result = Math.floor(v[0]); break;
    case "$ceil": result = Math.ceil(v[0]); break;
    case "$abs": result = Math.abs(v[0]); break;
    case "$round": {
      const digits = v[1] ?? 0;
      if (!Number.isInteger(digits) || digits < -10 || digits > 10) return null;
      const scale = Math.pow(10, digits); result = Math.round(v[0] * scale) / scale; break;
    }
    case "$lt": return v[0] < v[1];
    case "$lte": return v[0] <= v[1];
    case "$gt": return v[0] > v[1];
    case "$gte": return v[0] >= v[1];
  }
  return finite(result) ? result : null;
}

// Scope substitution uses $literal because item data may itself contain keys
// such as "$state". Recursively evaluating that data would turn an innocent
// dataset into a program. References are rebound to the same concrete instance.
function scopeValue(x, scope, ids, getPath, scopedItem = true) {
  if (Array.isArray(x)) return x.map(v => scopeValue(v, scope, ids, getPath, scopedItem));
  if (!object(x)) return x;
  const op = Object.keys(x)[0], a = x[op];
  if (op === "$literal") return x;
  if (!scopedItem && ["$item", "$index"].includes(op)) return x;
  if (op === "$map" && object(a)) return { $map: { ...scopeValue(a, scope, ids, getPath, scopedItem), to: scopeValue(a.to, scope, ids, getPath, false) } };
  if (["$item", "$index", "$scope", "$input"].includes(op)) {
    const value = op === "$index" ? scope.index : getPath(scope[op.slice(1)], a);
    return { $literal: value ?? null };
  }
  if (op === "$block" && typeof a === "string") {
    const dot = a.indexOf("."), id = dot < 0 ? a : a.slice(0, dot);
    return { $block: (ids[id] || id) + (dot < 0 ? "" : a.slice(dot)) };
  }
  if (op === "$tpl" && typeof a === "string") {
    const parts = []; let offset = 0;
    for (const m of a.matchAll(/\{\{\s*([a-zA-Z]+)\.([^}\s]+)\s*\}\}/g)) {
      parts.push(a.slice(offset, m.index), scopeValue({ ["$" + m[1]]: m[2] }, scope, ids, getPath, scopedItem)); offset = m.index + m[0].length;
    }
    parts.push(a.slice(offset)); return { $concat: parts };
  }
  const result = Object.fromEntries(Object.entries(x).map(([k, v]) => [k, scopeValue(v, scope, ids, getPath, scopedItem)]));
  if (["call", "setLocal"].includes(x.do) && typeof x.target === "string" && x.target !== "$self") result.target = ids[x.target] || x.target;
  return result;
}

/** Expand declarative templates into an ephemeral instance tree. Stored ids and
 * signatures stay untouched; stable typed keys preserve each control's locals.
 * Fail closed on ambiguous keys or cycles, with a bounded expansion budget. */
export function expandDocument(doc, ctx, evaluate, getPath, createCtx) {
  if (!doc.compositions && !Object.values(doc.blocks || {}).some(b => b.repeat)) return doc;
  const blocks = Object.create(null), pins = Object.create(null);
  const reachable = new Set();
  function mark(id) { if (reachable.has(id)) return; reachable.add(id); for (const children of Object.values(doc.blocks[id]?.slots || {})) children.forEach(mark); }
  mark(doc.root);
  for (const [id, block] of Object.entries(doc.blocks)) if (!reachable.has(id) && !block.repeat) blocks[id] = block;
  let count = 0;
  function contextFor(source, scope, expression) {
    function scopedReference(x) {
      if (Array.isArray(x)) return x.some(scopedReference);
      if (!object(x) || Object.keys(x)[0] === "$literal") return false;
      if (Object.keys(x)[0] === "$block" && typeof x.$block === "string" && own(scope.ids, x.$block.split(".")[0])) return true;
      return Object.values(x).some(scopedReference);
    }
    // Most inputs read item/state data. Building a whole context for every card
    // would make a large collection quadratic; only scoped output reads need it.
    if (!createCtx || !scopedReference(expression)) return ctx;
    const scoped = Object.fromEntries(Object.entries(scope.ids || {}).filter(([id]) => own(source, id)).map(([id, uid]) => [uid, scopeValue(source[id], scope, scope.ids, getPath)]));
    return createCtx({ ...doc, blocks: { ...doc.blocks, ...scoped, ...blocks } });
  }
  function visit(id, source, prefix, scope, ancestry, definitions) {
    if (ancestry.includes(id) || ancestry.length > 64 || definitions.length > 64) throw new Error("Composition/slot cycle at " + id);
    const b = source[id]; if (!b) throw new Error("Missing template " + id);
    // A repeat instance includes the template id as well as its typed key.
    // Independent repeat blocks with the same row keys must not share locals.
    if (b.repeat) {
      const each = evaluate(scopeValue(b.repeat.each, scope, scope.ids || {}, getPath), contextFor(source, scope, b.repeat.each));
      if (!Array.isArray(each)) throw new Error("repeat.each must evaluate to an array at " + id);
      const keys = new Set();
      return each.flatMap((item, index) => {
        const key = b.repeat.key ? getPath(item, b.repeat.key) : index;
        if (!(typeof key === "string" || finite(key))) throw new Error("repeat.key must be a string or finite number at " + id);
        const token = JSON.stringify(key);
        if (keys.has(token)) throw new Error("Duplicate repeat key " + token + " at " + id); keys.add(token);
        const instancePrefix = prefix + "/" + encodeURIComponent(id + ":" + token).replace(/\./g, "%2E");
        const descendants = new Set();
        function collect(k) { if (descendants.has(k)) return; descendants.add(k); for (const children of Object.values(source[k]?.slots || {})) children.forEach(collect); }
        collect(id);
        const ids = { ...scope.ids, ...Object.fromEntries([...descendants].map(k => [k, k + "~" + instancePrefix])) };
        const next = { ...scope, ids, item, index, scope: { ...scope.scope, ...(b.repeat.as ? { [b.repeat.as]: item } : {}) } };
        return visitOne(id, b, source, instancePrefix, next, ancestry, definitions);
      });
    }
    return visitOne(id, b, source, prefix, scope, ancestry, definitions);
  }
  function visitOne(id, b, source, prefix, scope, ancestry, definitions) {
    if (++count > 10000) throw new Error("Artifact exceeds 10000 rendered blocks");
    const uid = prefix ? id + "~" + prefix : id;
    const ids = scope.ids || {};
    const copy = scopeValue(b, scope, ids, getPath); delete copy.repeat;
    blocks[uid] = copy;
    if (doc.resolved?.blocks?.[(scope.pinPrefix || "") + id]) pins[uid] = doc.resolved.blocks[(scope.pinPrefix || "") + id];
    copy.slots = Object.fromEntries(Object.entries(b.slots || {}).map(([slot, children]) => [slot, children.flatMap(child => visit(child, source, prefix, scope, [...ancestry, id], definitions))]));
    if (b.type === "composition") {
      const name = b.props?.name, definition = own(doc.compositions, name) ? doc.compositions[name] : undefined;
      if (!definition) throw new Error("Unknown composition " + name);
      if (definitions.includes(name)) throw new Error("Recursive composition " + name);
      const input = evaluate(scopeValue(b.bind?.inputs || b.props?.inputs || {}, scope, ids, getPath), contextFor(source, scope, b.bind?.inputs || b.props?.inputs));
      if (!object(input)) throw new Error("Composition inputs must evaluate to an object at " + id);
      for (const key of Object.keys(input)) if (!own(definition.inputs || {}, key)) throw new Error("Unknown composition input " + key + " at " + id);
      const values = { ...Object.fromEntries(Object.entries(definition.inputs || {}).filter(([, s]) => s.default !== undefined).map(([k, s]) => [k, s.default])), ...input };
      for (const [key, spec] of Object.entries(definition.inputs || {})) {
        if ((spec.required && values[key] === undefined) || (values[key] !== undefined && !matchesInput(spec, values[key]))) throw new Error("Invalid composition input " + key + " at " + id);
      }
      const nextScope = { ...scope, pinPrefix: "compositions/" + name + "/", input: values, ids: { ...scope.ids, ...Object.fromEntries(Object.keys(definition.blocks).map(k => [k, k + "~" + prefix + "/" + encodeURIComponent(id + ":" + name)])) } };
      copy.slots.children = visit(definition.root, definition.blocks, prefix + "/" + encodeURIComponent(id + ":" + name), nextScope, [], [...definitions, name]);
      if (definition.output !== undefined) {
        const localIds = Object.fromEntries(Object.keys(definition.blocks).map(k => [k, k + "~" + prefix + "/" + encodeURIComponent(id + ":" + name)]));
        copy.bind = { ...copy.bind, value: scopeValue(definition.output, nextScope, localIds, getPath) };
      }
    }
    return [uid];
  }
  const roots = visit(doc.root, doc.blocks, "", { scope: {} }, [], []);
  let root = roots[0];
  if (roots.length !== 1) { root = "collection~root"; blocks[root] = { type: "stack", slots: { children: roots } }; }
  return { ...doc, root, blocks, resolved: doc.resolved ? { ...doc.resolved, blocks: pins } : undefined };
}

/** Check authoring errors on templates, including dormant definitions and
 * empty collections. Runtime expansion alone would hide those mistakes. */
export function advancedFindings(doc, baseValidate, isExpr, walkExpr, contractFor) {
  const errors = [];
  const fail = (at, code, msg) => errors.push({ at, code, msg });
  const definitions = doc.compositions || {};
  function checkBlocks(blocks, base) {
    const parent = new Map();
    for (const [id, b] of Object.entries(blocks || {})) for (const children of Object.values(b.slots || {})) for (const child of children) parent.set(child, id);
    function repeats(id) { const ids = new Set(), seen = new Set(); while (id && !seen.has(id)) { seen.add(id); if (blocks[id]?.repeat) ids.add(id); id = parent.get(id); } return ids; }
    for (const [id, b] of Object.entries(blocks || {})) {
      const at = base + "/" + id;
      const scope = repeats(id);
      function checkReference(arg) {
        const target = arg.split(".")[0];
        if ([...repeats(target)].some(r => !scope.has(r))) fail(at, "ambiguous-instance", "Reference to repeated block " + target + " must be inside the same repeat scope");
      }
      walkExpr([b.props, b.bind, b.on, b.watch, b.visible], (op, arg) => {
        if (op === "$block" && typeof arg === "string") checkReference(arg);
        if (op === "$tpl" && typeof arg === "string") for (const m of arg.matchAll(/\{\{\s*block\.([^}\s]+)\s*\}\}/g)) checkReference(m[1]);
      });
      for (const actions of Object.values(b.on || {})) for (const action of Array.isArray(actions) ? actions : []) { if (action.do === "call" && action.target !== "$self" && [...repeats(action.target)].some(r => !scope.has(r))) fail(at, "ambiguous-instance", "Call to a repeated block must be inside the same repeat scope"); }
      const c = contractFor ? contractFor(b.type) : null;
      for (const [slot, children] of Object.entries(b.slots || {})) if (c?.slots?.[slot]?.max && children.some(child => blocks[child]?.repeat)) fail(at + "/slots/" + slot, "repeat-slot-limit", "Place repeated blocks inside an unbounded container to respect slot cardinality");
      if (b.repeat !== undefined) {
        const r = b.repeat;
        if (!object(r) || !own(r, "each") || (r.as !== undefined && (typeof r.as !== "string" || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(r.as) || !safeKey(r.as))) || (r.key !== undefined && !safeKey(r.key)) || Object.keys(r).some(k => !["each", "as", "key"].includes(k))) fail(at + "/repeat", "bad-repeat", "repeat takes {each, as?: alias, key?: item path}");
        else if (!isExpr(r.each) && !Array.isArray(r.each)) fail(at + "/repeat/each", "bad-repeat", "repeat.each must be an array or expression");
      }
      walkExpr([b.props, b.bind, b.on, b.watch, b.visible, b.repeat?.each], (op, arg) => {
        const error = computationArgError(op, arg); if (error) fail(at, "bad-expr", error);
      });
      if (b.type === "composition") {
        const def = own(definitions, b.props?.name) ? definitions[b.props.name] : undefined;
        if (!def) { fail(at, "missing-composition", "Unknown composition " + b.props?.name); continue; }
        const values = b.props?.inputs || {};
        for (const [key, spec] of Object.entries(def.inputs || {})) {
          const value = values[key];
          if (spec.required && value === undefined && !own(b.bind || {}, "inputs") && spec.default === undefined) fail(at + "/props/inputs/" + key, "missing-input", "Composition requires " + key);
          if (value !== undefined && !isExpr(value) && !matchesInput(spec, value)) fail(at + "/props/inputs/" + key, "input-type", "Input " + key + " should be " + spec.type);
        }
        for (const key of Object.keys(values)) if (!own(def.inputs || {}, key)) fail(at + "/props/inputs/" + key, "unknown-input", "Unknown composition input " + key);
      }
    }
  }
  if (doc.compositions !== undefined && !object(doc.compositions)) fail("/compositions", "bad-composition", "compositions must be an object");
  checkBlocks(doc.blocks, "/blocks");
  for (const [name, def] of Object.entries(definitions)) {
    const at = "/compositions/" + name;
    if (typeof name !== "string" || !/^[a-z][a-zA-Z0-9_-]{0,47}$/.test(name) || !safeKey(name) || !object(def) || !object(def.blocks) || !object(def.inputs) || typeof def.root !== "string") { fail(at, "bad-composition", "Composition needs typed inputs, root and blocks"); continue; }
    for (const [key, spec] of Object.entries(def.inputs)) if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/.test(key) || !safeKey(key) || !object(spec) || !["string", "number", "boolean", "array", "object"].includes(spec.type) || (spec.default !== undefined && !matchesInput(spec, spec.default))) fail(at + "/inputs/" + key, "bad-input", "Inputs need a safe name, JSON type and compatible default");
    if (def.outputType && (!object(def.outputType) || typeof def.outputType.type !== "string" || !def.outputType.type.split("|").every(t => ["string", "number", "boolean", "array", "object", "null"].includes(t)))) fail(at + "/outputType", "bad-output", "Output needs a JSON type");
    let outputId = "compositionOutput"; while (own(def.blocks, outputId)) outputId += "X";
    const check = def.output === undefined ? { ...doc, root: def.root, blocks: def.blocks } : { ...doc, root: outputId, blocks: { ...def.blocks, [outputId]: { type: "composition", props: { name }, bind: { value: def.output }, slots: { children: [def.root] } } } };
    const result = baseValidate({ ...check, compositions: undefined });
    for (const e of result.errors) fail(e.at === "/blocks/" + outputId ? at + "/output" : at + e.at, e.code, e.msg);
    checkBlocks(def.blocks, at + "/blocks");
    walkExpr([def.blocks, def.output], (op, arg) => { if (op === "$input" && typeof arg === "string" && !own(def.inputs, arg.split(".")[0])) fail(at, "unknown-input", "Undeclared $input " + arg); });
    walkExpr(def.output, (op, arg) => { const error = computationArgError(op, arg); if (error) fail(at + "/output", "bad-expr", error); });
  }
  const colors = new Map();
  function visitDefinition(name, chain) {
    if (colors.get(name) === 1) { fail("/compositions/" + name, "composition-cycle", "Recursive composition: " + [...chain, name].join(" → ")); return; }
    if (colors.get(name) === 2 || !own(definitions, name)) return;
    colors.set(name, 1);
    for (const block of Object.values(definitions[name]?.blocks || {})) if (block.type === "composition") visitDefinition(block.props?.name, [...chain, name]);
    colors.set(name, 2);
  }
  for (const name of Object.keys(definitions)) visitDefinition(name, []);
  return errors;
}

/** Input contracts accept JSON values only; expressions are checked after they
 * resolve as well, so a state update cannot bypass a reusable component's type. */
export function matchesInput(spec, value) {
  return typeof spec.type === "string" && spec.type.split("|").some(type => type === "null" ? value === null : value != null && (type === "array" ? Array.isArray(value) : type === "object" ? object(value) : type === "number" ? finite(value) : typeof value === type)) && (!spec.enum || spec.enum.includes(value));
}
