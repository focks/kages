// Write one key into one layer's file. Atomic (temp file then rename) so a crash
// mid-write leaves the old file intact, and unknown keys already in the file are
// preserved: another tool or a newer Kages may own them.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { coerce, isLocalOnly, setPath, unsetPath, validateLayer } from "./schema.ts";

export type Target = "user" | "workspace" | "local";

export function defaultTarget(key: string): Target { return isLocalOnly(key) ? "local" : "workspace"; }

export interface WriteDeps { rename?: (from: string, to: string) => void }

function atomicWrite(file: string, text: string, mode: number | undefined, deps: WriteDeps): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text, mode ? { mode } : undefined);
  try { (deps.rename ?? renameSync)(tmp, file); } catch (e) { rmSync(tmp, { force: true }); throw e; }
}

function readObject(file: string, force: boolean): Record<string, unknown> {
  if (!existsSync(file)) return {};
  const text = readFileSync(file, "utf8");
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj as Record<string, unknown>;
    throw new Error("not an object");
  } catch (e) {
    if (!force) throw new Error(`${file} is not valid JSON (${(e as Error).message}); fix it, or re-run with --force to back it up and start fresh`);
    let bak = `${file}.bak`;
    for (let i = 1; existsSync(bak); i++) bak = `${file}.bak.${i}`;
    copyFileSync(file, bak);
    return {};
  }
}

export function setKey(file: string, key: string, raw: string, opts: { force?: boolean; user?: boolean } = {}, deps: WriteDeps = {}): unknown {
  const c = coerce(key, raw);
  if (!c.ok) throw new Error(c.message);
  const obj = readObject(file, !!opts.force);
  setPath(obj, key, c.value);
  if (!obj.version && !opts.user) obj.version = 1;
  const problems = validateLayer(obj, file, { allowSecrets: !!opts.user });
  if (problems.length) throw new Error(problems[0].message);
  atomicWrite(file, JSON.stringify(obj, null, 2) + "\n", opts.user ? 0o600 : undefined, deps);
  return c.value;
}

export function unsetKey(file: string, key: string, opts: { force?: boolean; user?: boolean } = {}, deps: WriteDeps = {}): boolean {
  if (!existsSync(file)) return false;
  const obj = readObject(file, !!opts.force);
  const removed = unsetPath(obj, key);
  if (removed) atomicWrite(file, JSON.stringify(obj, null, 2) + "\n", opts.user ? 0o600 : undefined, deps);
  return removed;
}
