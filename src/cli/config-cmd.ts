// `kages config list|get|set|unset|path`: the CLI face of the layered config in
// src/config. Keeps no logic of its own beyond choosing which layer file a key
// belongs in.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { kagesHome } from "./config.ts";
import { loadConfig, ENV_MAP } from "../config/load.ts";
import { KEYS, getPath } from "../config/schema.ts";
import { defaultTarget, setKey, unsetKey, type Target } from "../config/write.ts";
import { out, printJson } from "./format.ts";

const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : null);
const userFile = () => join(kagesHome(), "config.json");

export function layerFile(target: Target, dir: string): string {
  return target === "user" ? userFile() : join(dir, target === "local" ? "config.local.json" : "config.json");
}

export function configCmd(rest: string[], flags: Record<string, unknown>, dir: string): number {
  const sub = rest[0] ?? "list";
  const load = () => loadConfig({ readFile: read, userFile: userFile(), workspaceDir: dir, env: process.env });
  const json = !!flags.json;

  if (sub === "list") {
    const c = load();
    if (json) { printJson({ value: c.value, sources: c.sources, problems: c.problems }); return 0; }
    for (const key of Object.keys(KEYS)) {
      const v = getPath(c.value, key);
      out(`${key.padEnd(22)} ${v === undefined ? "(unset)" : JSON.stringify(v)}${c.sources[key] ? `  [${c.sources[key]}]` : ""}`);
    }
    for (const p of c.problems) out(`! ${p.message}`);
    return c.problems.length ? 1 : 0;
  }
  if (sub === "path") {
    out(`user       ${userFile()}\nworkspace  ${layerFile("workspace", dir)}\nlocal      ${layerFile("local", dir)}`);
    return 0;
  }
  const key = rest[1];
  if (!key) throw new Error(`usage: kages config ${sub} <key>${sub === "set" ? " <value>" : ""} [--user|--local]`);
  if (sub === "get") {
    const c = load();
    const v = getPath(c.value, key);
    if (json) printJson({ key, value: v ?? null, source: c.sources[key] ?? null });
    else out(v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v));
    return v === undefined ? 1 : 0;
  }
  const target: Target = flags.user ? "user" : flags.local ? "local" : defaultTarget(key);
  const file = layerFile(target, dir);
  if (sub === "set") {
    if (rest[2] === undefined) throw new Error(`usage: kages config set <key> <value> [--user|--local]`);
    if (!(key in KEYS)) out(`note: '${key}' is not a known setting; stored as-is`);
    const v = setKey(file, key, rest[2], { force: !!flags.force, user: target === "user" });
    out(`${key} = ${JSON.stringify(v)}  (${target}: ${file})`);
    return 0;
  }
  if (sub === "unset") {
    const removed = unsetKey(file, key, { force: !!flags.force, user: target === "user" });
    out(removed ? `removed ${key} from ${file}` : `${key} not set in ${file}`);
    return 0;
  }
  throw new Error(`unknown config command '${sub}' (list, get, set, unset, path)`);
}

export const configEnvVars = () => Object.entries(ENV_MAP).map(([env, key]) => `${env} → ${key}`);
