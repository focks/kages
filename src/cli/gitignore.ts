// The managed .gitignore block. Kages writes working files next to a project:
// some are shared (config.json, brief.md, critique/*.md) and must stay tracked,
// some are per-machine or ephemeral. Left alone, people commit screenshots and
// config.local.json, or ignore the shared files and lose them. The block is
// marker-delimited so we only ever rewrite our own lines. The string functions
// are pure; only `inspect` and the CLI glue touch git or disk.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const BLOCK_VERSION = 1;
const START = `# kages-ignore-start v${BLOCK_VERSION}`;
const END = "# kages-ignore-end";
/** Matches our markers at any version so a template bump reads as stale, not missing. */
const START_RE = /^# kages-ignore-start\b.*$/m;
const END_RE = /^# kages-ignore-end\b.*$/m;

/** Paths (relative to the workspace dir) that are never committed. */
const EPHEMERAL = ["store.json", "config.local.json", "screenshots/", "cache/", "review/", "report/", "advice.log.ndjson*", "hook.cache.json", "hook.pending.json", "install.json"];

export function renderBlock(opts: { trackStore?: boolean } = {}): string[] {
  const lines = EPHEMERAL.filter((p) => !(opts.trackStore && p === "store.json")).map((p) => `**/.kages/${p}`);
  return [START, "# Managed by `kages gitignore`. Shared artifacts stay tracked:", "#   config.json, brief.md, critique/*.md", ...lines, END];
}

export type BlockStatus = "missing" | "stale" | "current" | "unbalanced";

const eolOf = (text: string) => (text.includes("\r\n") ? "\r\n" : "\n");

function locate(text: string): { start: number; end: number } | "none" | "unbalanced" {
  const s = START_RE.exec(text), e = END_RE.exec(text);
  if (!s && !e) return "none";
  if (!s || !e || e.index < s.index) return "unbalanced";
  return { start: s.index, end: e.index + e[0].length };
}

export function status(text: string, block: string[]): BlockStatus {
  const loc = locate(text);
  if (loc === "none") return "missing";
  if (loc === "unbalanced") return "unbalanced";
  const eol = eolOf(text);
  return text.slice(loc.start, loc.end).split(/\r?\n/).join(eol) === block.join(eol) ? "current" : "stale";
}

/** Insert or replace the block. Lines outside the markers are never touched, and
 *  the file's own line endings are kept (a CRLF file must not become mixed). */
export function applyBlock(text: string, block: string[]): { text: string; changed: boolean } {
  const eol = eolOf(text), body = block.join(eol);
  const loc = locate(text);
  if (loc === "unbalanced") throw new Error("the kages-ignore markers are unbalanced (one of start/end is missing); fix or remove them by hand");
  let next: string;
  if (loc === "none") {
    const sep = text === "" ? "" : text.endsWith("\n") ? eol : eol + eol;
    next = text + sep + body + eol;
  } else {
    next = text.slice(0, loc.start) + body + text.slice(loc.end);
  }
  return { text: next, changed: next !== text };
}

export interface Inspection {
  root: string;
  file: string;
  status: BlockStatus;
  /** Files that should be ignored but are already tracked; Kages prints, never runs, the fix. */
  tracked: string[];
}

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

export function repoRoot(cwd: string): string | null {
  try { return git(cwd, "rev-parse", "--show-toplevel").trim() || null; } catch { return null; }
}

export function inspect(cwd: string, opts: { path?: string; trackStore?: boolean } = {}): Inspection | null {
  const root = repoRoot(cwd);
  if (!root) return null;
  const file = opts.path ?? join(root, ".gitignore");
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const tracked: string[] = [];
  try {
    const all = git(root, "ls-files").split("\n").filter(Boolean);
    const rx = new RegExp(`(^|/)\\.kages/(${EPHEMERAL.filter((p) => !(opts.trackStore && p === "store.json")).map((p) => p.replace(/[.+]/g, "\\$&").replace("*", ".*")).join("|")})`);
    for (const f of all) if (rx.test(f)) tracked.push(f);
  } catch { /* an unreadable index just means no hint */ }
  return { root, file, status: status(text, renderBlock(opts)), tracked };
}

/** A runtime folder ignores itself, so it stays out of commits even in projects
 *  that never ran the block (and the block cannot be forgotten by a new clone). */
export function ensureRuntimeDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const f = join(dir, ".gitignore");
  if (!existsSync(f)) writeFileSync(f, "*\n");
}

export function writeBlock(file: string, block: string[]): boolean {
  mkdirSync(dirname(file), { recursive: true });
  const before = existsSync(file) ? readFileSync(file, "utf8") : "";
  const r = applyBlock(before, block);
  if (r.changed) writeFileSync(file, r.text);
  return r.changed;
}
