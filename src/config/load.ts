// Layered config: defaults < user < workspace (tracked) < local (ignored) < env
// < flags. `loadConfig` is pure over an injected reader so precedence is testable
// without a disk. A bad file never throws on the read path (hooks and advice run
// on every edit): it is skipped, and the problem is reported alongside the value.

import { DEFAULTS, KEYS, getPath, setPath, unsetPath, validateLayer, type KagesConfig, type Layer, type Problem } from "./schema.ts";

export interface LoadInputs {
  /** Return the file's text, or null when it does not exist. */
  readFile: (path: string) => string | null;
  userFile: string;
  /** Workspace directory (holds config.json and config.local.json); omit for none. */
  workspaceDir?: string;
  env?: Record<string, string | undefined>;
  /** Already-typed values from CLI flags, keyed by dotted path. */
  flags?: Record<string, unknown>;
}

export interface LoadedConfig {
  value: KagesConfig;
  /** Which layer supplied each known dotted key that has a value. */
  sources: Record<string, Layer>;
  problems: Problem[];
}

/** Env var → key. Booleans accept 1/0/true/false. */
export const ENV_MAP: Record<string, string> = {
  KAGES_ADVICE_QUIET: "advice.quiet",
  KAGES_ADVICE_MIN_SEVERITY: "advice.minSeverity",
  KAGES_ADVICE_LOG: "advice.auditLog",
  KAGES_HOOK_ENABLED: "hook.enabled",
  KAGES_HOOK_QUIET: "hook.quiet",
  KAGES_SCREENSHOT_URL: "screenshot.url",
  KAGES_CHROME: "screenshot.chrome",
};

export const join = (dir: string, name: string) => dir.replace(/[\\/]+$/, "") + "/" + name;

function parseLayer(text: string | null, file: string, problems: Problem[], allowSecrets: boolean): Record<string, unknown> | null {
  if (text === null) return null;
  let obj: unknown;
  try { obj = JSON.parse(text); } catch (e) { problems.push({ file, message: `${file}: not valid JSON (${(e as Error).message})` }); return null; }
  const found = validateLayer(obj, file, { allowSecrets });
  problems.push(...found);
  // A layer with a bad key is still usable for its good keys, but a secret in a
  // shared file must not take effect at all.
  if (!allowSecrets && found.some((p) => p.key === "session" || p.key === "anonKey")) return null;
  // A value of the wrong type must not take effect ("yes" is truthy and would
  // silently flip a boolean); only the offending keys are dropped.
  for (const p of found) if (p.key && KEYS[p.key]) unsetPath(obj as Record<string, unknown>, p.key);
  return obj as Record<string, unknown>;
}

function envLayer(env: Record<string, string | undefined>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, key] of Object.entries(ENV_MAP)) {
    const raw = env[name];
    if (raw === undefined || raw === "") continue;
    const t = KEYS[key]?.type;
    if (t === "boolean") setPath(out, key, /^(1|true|yes|on)$/i.test(raw));
    else if (t === "boolean|string") setPath(out, key, /^(1|true|yes|on)$/i.test(raw) ? true : /^(0|false|no|off)$/i.test(raw) ? false : raw);
    else setPath(out, key, raw);
  }
  return out;
}

export function loadConfig(inp: LoadInputs): LoadedConfig {
  const problems: Problem[] = [];
  const layers: Array<[Layer, Record<string, unknown> | null]> = [
    ["default", DEFAULTS as Record<string, unknown>],
    ["user", parseLayer(inp.readFile(inp.userFile), inp.userFile, problems, true)],
  ];
  if (inp.workspaceDir) {
    const shared = join(inp.workspaceDir, "config.json"), local = join(inp.workspaceDir, "config.local.json");
    layers.push(["workspace", parseLayer(inp.readFile(shared), shared, problems, false)]);
    layers.push(["local", parseLayer(inp.readFile(local), local, problems, false)]);
  }
  layers.push(["env", envLayer(inp.env ?? {})]);
  const flags: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(inp.flags ?? {})) setPath(flags, k, v);
  layers.push(["flag", flags]);

  const value: Record<string, unknown> = {};
  const sources: Record<string, Layer> = {};
  for (const [layer, obj] of layers) {
    if (!obj) continue;
    for (const key of Object.keys(KEYS)) {
      const v = getPath(obj, key);
      if (v === undefined) continue;
      setPath(value, key, JSON.parse(JSON.stringify(v)));
      sources[key] = layer;
    }
    // Keys we do not know about ride along from the highest layer that has them.
    for (const [k, v] of Object.entries(obj)) if (!(k in value) && !Object.keys(KEYS).some((x) => x.startsWith(k + "."))) value[k] = v;
  }
  value.version = 1;
  return { value: value as KagesConfig, sources, problems };
}
