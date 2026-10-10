// The CLI's home under ~/.kages: config (including the signed-in session) and a
// small on-disk cache. Config is written 0600 since it holds auth tokens. Override
// the location with $KAGES_CONFIG_HOME (useful for tests).

import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from "node:fs";

export const KAGES_HOME = process.env.KAGES_CONFIG_HOME ?? join(homedir(), ".kages");
const CONFIG_FILE = join(KAGES_HOME, "config.json");
const CACHE_DIR = join(KAGES_HOME, "cache");

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  email: string;
}

export interface CliConfig {
  apiUrl?: string;       // the deployment the CLI talks to
  supabaseUrl?: string;
  anonKey?: string;
  session?: Session;
}

export function readConfig(): CliConfig {
  try { return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as CliConfig; } catch { return {}; }
}

export function writeConfig(cfg: CliConfig): void {
  mkdirSync(KAGES_HOME, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
}

export function clearSession(): void {
  const cfg = readConfig();
  delete cfg.session;
  writeConfig(cfg);
}

// --- cache (best-effort; a failure never breaks a command) -----------------

function cachePath(key: string): string {
  return join(CACHE_DIR, key.replace(/[^a-zA-Z0-9_.-]/g, "_") + ".json");
}

/** Read a cached value if present and younger than maxAgeMs; else null. */
export function cacheGet<T>(key: string, maxAgeMs: number): T | null {
  try {
    const p = cachePath(key);
    if (Date.now() - statSync(p).mtimeMs > maxAgeMs) return null;
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch { return null; }
}

export function cacheSet(key: string, value: unknown): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cachePath(key), JSON.stringify(value));
  } catch { /* cache is best-effort */ }
}

export function cacheClear(): void {
  try { rmSync(CACHE_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
}

export function configExists(): boolean { return existsSync(CONFIG_FILE); }
