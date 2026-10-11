// The generation envelope (tier B): compile a design system into ONE strict
// JSON Schema any structured-output model can be constrained to — every object
// closed, every key required, optional = nullable, free-form values as JSON
// strings. fromGenerated/toGenerated convert between envelope and document.
// Ported from the oracle. See oracle/agent-access.feature.

import { systems, contracts } from "./data.ts";
import { resolve, systemOf } from "./resolve.ts";
import { isExpr } from "./expr.ts";
import type { KageDoc, PropSpec, Json } from "./types.ts";

type Any = any;

// Strict structured-output modes (OpenAI et al.) accept only a JSON-Schema
// SUBSET: every object closed (additionalProperties:false), every key required,
// so "optional" must be expressed as a nullable type rather than an absent key.
// strictOf compiles one contract prop into that subset, or returns null when it
// can't — a union, an expression-bearing prop, a loosely typed value — in which
// case the caller emits it as a "<name>_json" string the model fills with raw
// JSON and fromGenerated parses back. That escape hatch is why ANY model, even
// one with no schema mode, can still produce a valid Kage.
function strictOf(spec: PropSpec): Any {
  if (!spec || !spec.type) return null;
  const types = spec.type.split("|");
  if (types.length === 1 && types[0] === "array" && spec.items && strictOf(spec.items)) return { type: ["array", "null"], items: strictOf(spec.items) };
  if (types.length === 1 && types[0] === "object" && spec.properties) {
    const props: Record<string, Any> = {};
    const req: string[] = [];
    Object.keys(spec.properties).forEach((k) => { const sub = strictOf(spec.properties![k]); props[k] = sub || { type: ["string", "null"] }; req.push(k); });
    return { type: ["object", "null"], properties: props, required: req, additionalProperties: false };
  }
  if (types.every((t) => t === "string" || t === "number" || t === "boolean")) {
    const o: Any = { type: (types as string[]).concat(["null"]) };
    if (spec.enum) o.enum = spec.enum.concat([null]);
    return o;
  }
  return null; // not expressible strictly -> JSON string
}

export function generationSchema(systemId: string): Any {
  const sys = systems[systemId];
  const variants: Any[] = [];
  Object.keys(sys.components).forEach((name) => {
    const c = contracts[sys.components[name]];
    const props: Record<string, Any> = {};
    const preq: string[] = [];
    const slots: Record<string, Any> = {};
    const sreq: string[] = [];
    Object.keys(c.props).forEach((k) => {
      const st = strictOf(c.props[k]);
      if (st) { props[k] = st; preq.push(k); }
      else { props[k + "_json"] = { type: ["string", "null"], description: "JSON-encoded value for `" + k + "`" }; preq.push(k + "_json"); }
    });
    Object.keys(c.slots).forEach((sl) => { slots[sl] = { type: "array", items: { type: "string" } }; sreq.push(sl); });
    const evs = Object.keys(c.events);
    const bindable = Object.keys(c.props);
    variants.push({
      type: "object",
      description: c.ref + " — " + c.summary + (c.agent.use ? " Use: " + c.agent.use : ""),
      additionalProperties: false,
      required: ["id", "type", "props", "slots", "bind", "on", "visible_json", "repeat_json"],
      properties: {
        id: { type: "string", description: "lowerCamel id, unique" },
        type: { type: "string", enum: [name] },
        props: { type: "object", properties: props, required: preq, additionalProperties: false },
        slots: { type: "object", properties: slots, required: sreq, additionalProperties: false },
        bind: { type: "array", items: { type: "object", additionalProperties: false, required: ["prop", "expr_json"], properties: { prop: { type: "string", enum: bindable.length ? bindable : ["_none"] }, expr_json: { type: "string", description: 'A Kages expression as JSON, e.g. {"$state":"region"}' } } } },
        on: { type: "array", items: { type: "object", additionalProperties: false, required: ["event", "actions_json"], properties: { event: { type: "string", enum: evs.length ? evs : ["_none"] }, actions_json: { type: "string", description: "JSON array of actions" } } } },
        repeat_json: { type: ["string", "null"], description: "Repeat template: JSON {each, as?, key?}; null for one instance" },
        visible_json: { type: ["string", "null"], description: "Optional expression as JSON" },
      },
    });
  });
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Kage generation envelope for " + sys.name + " " + sys.version,
    type: "object",
    additionalProperties: false,
    required: ["title", "root", "state_json", "data_json", "compositions_json", "blocks"],
    properties: {
      title: { type: "string" },
      root: { type: "string" },
      state_json: { type: "string", description: "JSON object of initial app state" },
      data_json: { type: ["string", "null"], description: "JSON object of static datasets" },
      compositions_json: { type: ["string", "null"], description: "JSON object of local compositions: typed inputs, root, blocks, optional output" },
      blocks: { type: "array", items: { anyOf: variants } },
    },
  };
}

function parseJ(s: Any, fallback?: Any): Any {
  if (s == null || s === "") return fallback;
  try { return JSON.parse(s); } catch (e: Any) { return { $parseError: String(e.message) }; }
}

function stripNull(v: Any): Any {
  if (Array.isArray(v)) return v.map(stripNull);
  if (v && typeof v === "object") { const o: Any = {}; for (const k in v) if (v[k] !== null) o[k] = stripNull(v[k]); return o; }
  return v;
}

export function fromGenerated(gen: Any, systemId: string): KageDoc {
  const doc: Any = {
    kages: "1.0",
    id: String(gen.title || "kage").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kage",
    title: gen.title,
    system: systemId + "@" + systems[systemId].version.split(".")[0],
    root: gen.root,
    state: parseJ(gen.state_json, {}),
    blocks: {},
  };
  const data = parseJ(gen.data_json, null);
  if (data) doc.data = data;
  const compositions = parseJ(gen.compositions_json, null);
  if (compositions) doc.compositions = compositions;
  (gen.blocks || []).forEach((g: Any) => {
    const b: Any = { type: g.type };
    const props: Any = {};
    Object.keys(g.props || {}).forEach((k) => {
      const v = g.props[k];
      if (v === null) return;
      if (/_json$/.test(k)) props[k.slice(0, -5)] = parseJ(v);
      else props[k] = stripNull(v);
    });
    if (Object.keys(props).length) b.props = props;
    const sl: Any = {};
    Object.keys(g.slots || {}).forEach((k) => { if (g.slots[k].length) sl[k] = g.slots[k]; });
    if (Object.keys(sl).length) b.slots = sl;
    if (g.bind && g.bind.length) { b.bind = {}; g.bind.forEach((x: Any) => { b.bind[x.prop] = parseJ(x.expr_json); }); }
    if (g.on && g.on.length) { b.on = {}; g.on.forEach((x: Any) => { b.on[x.event] = parseJ(x.actions_json, []); }); }
    if (g.repeat_json) b.repeat = parseJ(g.repeat_json);
    if (g.visible_json) b.visible = parseJ(g.visible_json);
    doc.blocks[g.id] = b;
  });
  return doc;
}

function fill(st: Any, v: Any): Any {
  if (v == null) return null;
  if (st.items && Array.isArray(v)) return v.map((x: Any) => fill(st.items, x));
  if (st.properties && typeof v === "object") { const o: Any = {}; Object.keys(st.properties).forEach((k) => { o[k] = v[k] === undefined ? null : fill(st.properties[k], v[k]); }); return o; }
  return v;
}

export function toGenerated(doc: KageDoc, systemId?: string): Any {
  const sysId = systemId || systemOf(doc);
  const out: Any = {
    title: doc.title,
    root: doc.root,
    state_json: JSON.stringify(doc.state || {}),
    data_json: doc.data ? JSON.stringify(doc.data) : null,
    compositions_json: doc.compositions ? JSON.stringify(doc.compositions) : null,
    blocks: [],
  };
  Object.keys(doc.blocks).forEach((id) => {
    const b = doc.blocks[id];
    const r = resolve(sysId, b.type);
    const c = r.contract!;
    const name = c.name;
    const props: Any = {};
    const slots: Any = {};
    const own: Any = { ...(b.props || {}), ...(((b.props || {}).x as Any) || {})[sysId] };
    Object.keys(c.props).forEach((k) => {
      const st = strictOf(c.props[k]);
      const v = own[k];
      if (st) props[k] = v === undefined || isExpr(v) ? null : fill(st, v);
      else props[k + "_json"] = v === undefined ? null : JSON.stringify(v);
    });
    Object.keys(c.slots).forEach((sl) => { slots[sl] = (b.slots || {})[sl] || []; });
    out.blocks.push({
      id,
      type: name,
      props,
      slots,
      bind: Object.entries({ ...Object.fromEntries(Object.entries(own).filter(([k, v]) => c.props[k] && strictOf(c.props[k]) && isExpr(v))), ...b.bind }).map(([prop, value]) => ({ prop, expr_json: JSON.stringify(value) })),
      on: Object.keys(b.on || {}).map((k) => ({ event: k, actions_json: JSON.stringify(b.on![k]) })),
      repeat_json: b.repeat === undefined ? null : JSON.stringify(b.repeat),
      visible_json: b.visible === undefined ? null : JSON.stringify(b.visible),
    });
  });
  return out;
}
