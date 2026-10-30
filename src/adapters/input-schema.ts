// Transport schemas and dispatch validation share this small JSON Schema subset.
// Nested data still passes through the engine/store validators; transport errors
// must identify bad fields before a handler can coerce them or throw internally.
export interface InputSchema {
  type?: string | string[];
  anyOf?: InputSchema[];
  enum?: unknown[];
  properties?: Record<string, InputSchema>;
  additionalProperties?: boolean | InputSchema;
  required?: string[];
  items?: InputSchema;
  minimum?: number;
  maximum?: number;
  description?: string;
}
const str: InputSchema = { type: "string" };
const bool: InputSchema = { type: "boolean" };
const integer: InputSchema = { type: "integer", minimum: 0 };
const obj: InputSchema = { type: "object" };
const strings: InputSchema = { type: "array", items: str };
const choice = (...values: string[]): InputSchema => ({ type: "string", enum: values });
const patch: InputSchema = { type: "array", items: { type: "object", required: ["op", "path"], properties: { op: choice("add", "remove", "replace", "move", "copy", "test"), path: str, from: str, value: {} }, additionalProperties: false } };
const evidence: InputSchema = { type: "array", items: { type: "object", required: ["kind", "ref"], properties: { kind: choice("data", "quote", "asset", "link"), ref: str, note: str }, additionalProperties: false } };
const brief: InputSchema = { type: "object", properties: { mode: choice("read", "operate", "persuade", "experience"), users: str, purpose: str, audience: str, job: str, primaryAction: str, evidence, schema: { type: "integer", enum: [1] }, positioning: str, operatingContext: str, voice: str, brandCommitments: str, constraints: strings, absent: strings, principles: strings, openDecisions: strings, inferred: strings, useScene: str, notes: str } };
const shared: Record<string, InputSchema> = {
  personality: choice("analytical", "editorial", "exploratory", "teaching", "showcase"),
  sort: choice("top", "newest"), offset: integer,
  origins: strings, toc: choice("auto", "always", "never"),
  density: choice("comfortable", "compact"), appearance: choice("inherit", "light", "dark"),
  ...Object.fromEntries(["path", "system", "design", "brand", "ref", "text", "label", "author", "name", "uuid", "intent", "repo", "command", "title", "markdown", "id", "kage", "reason", "body", "degradedReason", "fingerprint", "block", "parent"].map(k => [k, str])),
  ...Object.fromEntries(["apply", "all", "full", "merge", "resolved", "default", "keepSystem", "publish_all"].map(k => [k, bool])),
  ...Object.fromEntries(["version", "baseVersion", "baseRevision", "index", "limit", "since"].map(k => [k, integer])),
  doc: obj, definition: obj, intake: obj, spec: obj, envelope: obj, brief, ops: patch, suggestedPatch: patch,
  direction: choice("bolder", "quieter"), amount: { type: "number", minimum: 0 }, scope: { type: ["string", "array"], items: str },
  mode: choice("read", "operate", "persuade", "experience"), advice: choice("full", "quiet", "off"), minSeverity: choice("P0", "P1", "P2", "P3"),
  state: choice("draft", "review", "published", "deprecated", "archived"), visibility: choice("private", "workspace", "link", "public"),
  method: choice("dual-agent", "degraded", "single"), status: choice("open", "fixed", "wontfix"), format: choice("json", "markdown", "card"), tier: choice("immediate", "deep", "all"),
  scores: { type: "object", properties: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i + 1), { type: ["integer", "null"], minimum: 0, maximum: 4 }])), additionalProperties: false },
  naReasons: { type: "object", additionalProperties: str },
  priorities: { type: "array", items: { type: "object", required: ["sev", "title", "fix"], properties: { sev: choice("P0", "P1", "P2", "P3"), title: str, why: str, fix: str, command: str, block: str, status: choice("open", "fixed", "wontfix") }, additionalProperties: false } },
  render: { type: "object", properties: { widths: { type: "array", items: integer }, findings: strings, shots: strings, unavailable: str } },
  blocks: strings, projects: strings, types: strings, ttl: { type: "number", minimum: 1, maximum: 3600 }, x: { type: "number", minimum: 0, maximum: 1 }, y: { type: "number", minimum: 0, maximum: 1 }, value: { type: "integer", enum: [-1, 0, 1] },
};

// What an agent cannot infer from the name. `doc` and friends are bare objects in the
// schema, so their description is the only place the expected shape is visible.
const DESCRIPTIONS: Record<string, string> = {
  fingerprint: "The digest from the reviewed critique packet target.digest; never substitute a newer head.",
  doc: "A full Kage: {kages:\"1.0\", id, title, system, root, blocks:{<id>:{type, props, slots, on}}, state?, data?, brief?}",
  envelope: "The generation envelope that get_generation_schema describes",
  definition: "A workspace design definition: colours, type and radius; see get_design",
  intake: "Answers from a decision guide intake",
  spec: "The specification this operation reads; see the operation summary",
  ops: "RFC 6902 operations. add, replace and test need `value`; move and copy need `from`.",
  suggestedPatch: "RFC 6902 operations that would fix the finding",
  name: "The Kage's name, which is its document id",
  kage: "The Kage's name, which is its document id",
  uuid: "The Kage's stable share id",
  repo: "The home project: lowercase letters, digits and dashes",
  ref: "A contract ref (core/stat@1.0.0, core/stat) or block type (stat)",
  system: "A design system id such as core, ledger or atelier",
  version: "A version number; omit for the latest",
  baseVersion: "The version your edit started from. Behind head, the edit is merged and overlapping changes are reported as conflicts.",
  advice: "How much lint to return after a successful write: full, quiet or off",
  minSeverity: "The lowest finding severity to return",
  all: "Include everything rather than only new findings",
  visibility: "Who can open it: private, workspace, link or public",
  apply: "Write the result; omit to get the plan only",
  since: "The cursor returned by the previous call",
  path: "A path inside the skill pack, such as reference/examples/evidence-workbench.kage.json",
  text: "The text to search or parse",
  blocks: "Block ids; `root` claims the document's structure",
  ttl: "Lease length in seconds",
};

/** Every declared parameter must have a type; newly added operations cannot silently publish empty schemas. */
export function operationSchema(op: string, params: string[]): InputSchema {
  const properties: Record<string, InputSchema> = {};
  for (const raw of params) {
    const key = raw.replace(/\?$/, "");
    const schema = shared[key];
    if (!schema) throw new Error(`missing input schema for ${op}.${key}`);
    let actual = schema;
    if (key === "brief" && op !== "set_brief") actual = { ...brief, properties: { ...brief.properties, evidence: { type: "array", items: { anyOf: [str, { type: "object", required: ["source"], properties: { source: str, block: str, claim: str }, additionalProperties: false }] } } } };
    if (key === "brief" && op === "set_brief") actual = { ...brief, properties: Object.fromEntries(Object.entries(brief.properties!).map(([k, v]) => [k, { anyOf: [v, { type: "null" }] }])) };
    if (op === "vote_gallery_kage" && key === "value") actual = { type: "integer", enum: [0, 1] };
    if (op === "list_gallery" && key === "limit") actual = { type: "integer", minimum: 1, maximum: 48 };
    if (op === "list_gallery" && key === "text") actual = { type: "string" };
    properties[key] = { ...actual, description: DESCRIPTIONS[key] ?? key.replace(/[A-Z_]/g, (c) => " " + c.replace("_", "").toLowerCase()) };
  }
  return { type: "object", properties, required: params.filter(p => !p.endsWith("?")), additionalProperties: true };
}

/** Validate the same subset we publish, returning JSON pointers for repairable input errors. */
export function inputErrors(schema: InputSchema, value: unknown, path = ""): { at: string; msg: string }[] {
  const errors: { at: string; msg: string }[] = [];
  if (schema.anyOf && !schema.anyOf.some(s => inputErrors(s, value, path).length === 0)) return [{ at: path || "/", msg: "does not match an allowed shape" }];
  const add = (msg: string) => errors.push({ at: path || "/", msg });
  const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  const types = typeof schema.type === "string" ? [schema.type] : schema.type;
  if (types && !types.some(t => t === type || t === "integer" && typeof value === "number" && Number.isInteger(value))) { add(`expected ${types.join(" or ")}`); return errors; }
  if (schema.enum && !schema.enum.includes(value)) add(`expected one of ${schema.enum.join(", ")}`);
  if (typeof value === "number" && (!Number.isFinite(value) || schema.minimum !== undefined && value < schema.minimum || schema.maximum !== undefined && value > schema.maximum)) add("number outside allowed range");
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => errors.push(...inputErrors(schema.items!, v, `${path}/${i}`)));
  if (type === "object") {
    const o = value as Record<string, unknown>;
    for (const k of schema.required ?? []) if (!Object.prototype.hasOwnProperty.call(o, k)) errors.push({ at: `${path}/${k}`, msg: "required" });
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined && !schema.required?.includes(k)) continue;
      const child = Object.prototype.hasOwnProperty.call(schema.properties ?? {}, k) ? schema.properties![k] : typeof schema.additionalProperties === "object" ? schema.additionalProperties : undefined;
      const at = `${path}/${k.replace(/~/g, "~0").replace(/\//g, "~1")}`;
      if (child) errors.push(...inputErrors(child, v, at));
      else if (schema.additionalProperties === false) errors.push({ at, msg: "unknown field" });
    }
  }
  return errors;
}
