// Settings schema for the layered config. Hand-validated (no schema dependency):
// the set of keys is small and every message must name the file and key path so
// a malformed team config is fixable without reading source. Pure.

export type Severity = "P0" | "P1" | "P2" | "P3";

export interface KagesConfig {
  version?: 1;
  advice?: { quiet?: boolean; minSeverity?: Severity; auditLog?: string | boolean; logBlockIds?: boolean };
  lint?: { deprecations?: "warn" | "block-new"; ignoreRules?: string[]; ignoreBlocks?: { rule: string; block: string; reason: string }[] };
  hook?: { enabled?: boolean; quiet?: boolean; perEditRules?: "immediate" | "all"; consent?: "accepted" | "declined" };
  screenshot?: { url?: string; chrome?: string; noSandbox?: boolean };
  doctor?: { ignore?: string[] };
  install?: { providers?: string[]; scope?: "project" | "global" };
  report?: { redact?: "none" | "text" };
  [unknown: string]: unknown;
}

export type Layer = "default" | "user" | "workspace" | "local" | "env" | "flag";
export interface Problem { file: string; key?: string; message: string }

type Kind = "boolean" | "string" | "string[]" | { enum: readonly string[] } | "boolean|string" | "ignoreBlocks";
export interface KeyMeta { type: Kind; localOnly?: boolean; description: string }

/** Every known key. `localOnly` keys describe this machine or this person, so
 *  `config set` writes them to the ignored local file by default. */
export const KEYS: Record<string, KeyMeta> = {
  "advice.quiet": { type: "boolean", description: "Return nothing when a write is clean" },
  "advice.minSeverity": { type: { enum: ["P0", "P1", "P2", "P3"] }, description: "Lowest severity returned with a write" },
  "advice.auditLog": { type: "boolean|string", localOnly: true, description: "Write an NDJSON audit log (true, or a path)" },
  "advice.logBlockIds": { type: "boolean", localOnly: true, description: "Include block ids (never text) in audit log lines" },
  "lint.deprecations": { type: { enum: ["warn", "block-new"] }, description: "warn (default) reports deprecated use; block-new refuses a write that adds more" },
  "lint.ignoreRules": { type: "string[]", description: "Rule ids that never report" },
  "lint.ignoreBlocks": { type: "ignoreBlocks", description: "Per-block waivers; each needs a reason" },
  "hook.enabled": { type: "boolean", description: "Run the edit hook" },
  "hook.quiet": { type: "boolean", description: "No acknowledgement when the edit is clean" },
  "hook.perEditRules": { type: { enum: ["immediate", "all"] }, description: "Which rule tier runs on every edit" },
  "hook.consent": { type: { enum: ["accepted", "declined"] }, localOnly: true, description: "Remembered answer to the hook install prompt" },
  "screenshot.url": { type: "string", description: "App URL the screenshot command renders against" },
  "screenshot.chrome": { type: "string", localOnly: true, description: "Path to the Chrome binary" },
  "screenshot.noSandbox": { type: "boolean", localOnly: true, description: "Pass --no-sandbox to Chrome" },
  "doctor.ignore": { type: "string[]", description: "Doctor finding ids to stop reporting" },
  "install.providers": { type: "string[]", description: "Harnesses to install into" },
  "install.scope": { type: { enum: ["project", "global"] }, description: "Install scope" },
  "report.redact": { type: { enum: ["none", "text"] }, description: "How much `kages report` redacts" },
};

export const DEFAULTS: KagesConfig = {
  version: 1,
  advice: { quiet: false, minSeverity: "P2" },
  hook: { enabled: true, quiet: false, perEditRules: "immediate" },
};

/** Auth lives only in the user file; a token in a file that gets committed is a leak. */
export const SECRET_KEYS = ["session", "anonKey"];

export const isLocalOnly = (key: string): boolean => KEYS[key]?.localOnly === true;

function checkValue(file: string, key: string, meta: KeyMeta, v: unknown): Problem | null {
  const bad = (what: string): Problem => ({ file, key, message: `${file}: ${key} must be ${what}` });
  const t = meta.type;
  if (t === "boolean") return typeof v === "boolean" ? null : bad("true or false");
  if (t === "string") return typeof v === "string" ? null : bad("a string");
  if (t === "boolean|string") return typeof v === "boolean" || typeof v === "string" ? null : bad("true, false or a path string");
  if (t === "string[]") return Array.isArray(v) && v.every((x) => typeof x === "string") ? null : bad("a list of strings");
  if (t === "ignoreBlocks") {
    const ok = Array.isArray(v) && v.every((x) => x && typeof x === "object" && typeof (x as { rule?: unknown }).rule === "string" && typeof (x as { block?: unknown }).block === "string" && typeof (x as { reason?: unknown }).reason === "string" && (x as { reason: string }).reason.trim() !== "");
    return ok ? null : bad("a list of {rule, block, reason} with a non-empty reason");
  }
  return typeof v === "string" && t.enum.includes(v) ? null : bad(`one of ${t.enum.join(", ")}`);
}

/** Validate one layer's parsed object. Unknown keys are allowed (forward
 *  compatibility) and never reported; known keys are type-checked. */
export function validateLayer(obj: unknown, file: string, opts: { allowSecrets?: boolean } = {}): Problem[] {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return [{ file, message: `${file}: must be a JSON object` }];
  const problems: Problem[] = [];
  const o = obj as Record<string, unknown>;
  if (!opts.allowSecrets) for (const s of SECRET_KEYS) if (s in o) problems.push({ file, key: s, message: `${file}: '${s}' belongs in the user config (~/.kages/config.json), never in a workspace file` });
  for (const [path, meta] of Object.entries(KEYS)) {
    const v = getPath(o, path);
    if (v === undefined) continue;
    const p = checkValue(file, path, meta, v);
    if (p) problems.push(p);
  }
  return problems;
}

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur = obj;
  for (const part of parts.slice(0, -1)) {
    if (cur[part] === null || typeof cur[part] !== "object" || Array.isArray(cur[part])) cur[part] = {};
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export function unsetPath(obj: Record<string, unknown>, path: string): boolean {
  const parts = path.split(".");
  const parents: Record<string, unknown>[] = [obj];
  let cur = obj;
  for (const part of parts.slice(0, -1)) {
    const next = cur[part];
    if (next === null || typeof next !== "object") return false;
    cur = next as Record<string, unknown>;
    parents.push(cur);
  }
  const last = parts[parts.length - 1];
  if (!(last in cur)) return false;
  delete cur[last];
  // Drop containers this left empty so `unset` does not leave `{"advice":{}}` behind.
  for (let i = parts.length - 2; i >= 0; i--) if (Object.keys(parents[i + 1]).length === 0) delete parents[i][parts[i]];
  return true;
}

/** Parse a CLI string into the typed value the key expects. */
export function coerce(key: string, raw: string): { ok: true; value: unknown } | { ok: false; message: string } {
  const meta = KEYS[key];
  if (!meta) return { ok: true, value: tryJson(raw) };
  const t = meta.type;
  if (t === "boolean") return /^(true|1|yes|on)$/i.test(raw) ? { ok: true, value: true } : /^(false|0|no|off)$/i.test(raw) ? { ok: true, value: false } : { ok: false, message: `${key} must be true or false` };
  if (t === "boolean|string") return /^(true|1|yes|on)$/i.test(raw) ? { ok: true, value: true } : /^(false|0|no|off)$/i.test(raw) ? { ok: true, value: false } : { ok: true, value: raw };
  if (t === "string") return { ok: true, value: raw };
  if (t === "string[]") { const v = tryJson(raw); return { ok: true, value: Array.isArray(v) ? v : raw.split(",").map((s) => s.trim()).filter(Boolean) }; }
  if (t === "ignoreBlocks") return { ok: true, value: tryJson(raw) };
  return t.enum.includes(raw) ? { ok: true, value: raw } : { ok: false, message: `${key} must be one of ${t.enum.join(", ")}` };
}

function tryJson(raw: string): unknown { try { return JSON.parse(raw); } catch { return raw; } }
