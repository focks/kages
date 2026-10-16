// The edit hook. A coding agent that writes `*.kage.json` files straight to disk gets no
// feedback until someone runs `kages validate`; this closes that gap at the moment of the
// edit. It is built to be invisible when it has nothing to say: it never throws, never
// writes to stderr, always exits 0 (except a deliberate pre-write deny), and reports a
// finding once, when it first appears. The core is pure over an injected filesystem so
// every branch is testable without touching a disk.
import { createHash } from "node:crypto";
import { detectHarness, type Harness, type HookEvent, type Payload } from "./harnesses.ts";
import { loadConfig } from "../config/load.ts";
import type { KageDoc } from "../engine/types.ts";

export interface HookFs {
  readText(path: string): string | null;
  size(path: string): number | null;
  /** Resolve symlinks; null when the path does not exist. */
  realpath(path: string): string | null;
  writeText(path: string, text: string): void;
  /** Create a runtime dir that ignores itself (kept out of commits). */
  ensureRuntimeDir(path: string): void;
}

export interface HookInput {
  stdin: string;
  fs: HookFs;
  cwd: string;
  home?: string;
  env?: Record<string, string | undefined>;
  harness?: string;
  event?: string;
  now?: () => number;
}
export interface HookOutput { stdout: string; exit: number }

export const MAX_STDIN = 1024 * 1024;
export const MAX_FILE = 2 * 1024 * 1024;
export const MAX_LINES = 8;
export const MAX_OUT = 2048;
const SKIP_DIR = /(^|\/)(node_modules|\.git|\.next|dist)(\/|$)/;
const SEV_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, error: 0 };

export interface HookFinding { key: string; line: string; severity: string }
interface Cache { files: Record<string, { hash: string; keys: string[]; deepKeys?: string[] }>; pending: string[] }

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const silent: HookOutput = { stdout: "", exit: 0 };

/** Line and column of a JSON syntax error, from the engine's own message when it has a position. */
export function badJson(text: string, err: Error): { line: number; col: number; msg: string } {
  const m = /position (\d+)/.exec(err.message);
  let pos = m ? Number(m[1]) : text.length;
  if (!m && /Unexpected end/.test(err.message)) pos = text.length;
  pos = Math.min(pos, text.length);
  const before = text.slice(0, pos).split("\n");
  return { line: before.length, col: before[before.length - 1].length + 1, msg: err.message.replace(/^JSON\.parse: /, "").replace(/ in JSON at position \d+.*$/, "").replace(/\s*\(line \d+ column \d+\)/, "") };
}

async function checkFile(rel: string, text: string, scope: "immediate" | "deep" | "all", ignoreRules: readonly string[]): Promise<HookFinding[]> {
  let doc: KageDoc;
  try { doc = JSON.parse(text) as KageDoc; }
  catch (e) { const b = badJson(text, e as Error); return [{ key: `${rel}|bad-json`, severity: "error", line: `${rel}:${b.line}:${b.col} bad-json: ${b.msg}` }]; }
  // Loaded only now: a hook for a file that is not a Kage must not pay for the engine.
  const [{ validate }, { lintDetailed }] = await Promise.all([import("../engine/validate.ts"), import("../engine/advice.ts")]);
  const out: HookFinding[] = [];
  if (scope !== "deep") for (const e of validate(doc).errors) out.push({ key: `${rel}|${e.code}|${e.at}`, severity: "error", line: `${rel} ${e.at} ${e.code}: ${e.msg}` });
  for (const f of lintDetailed(doc, { ...(scope === "all" ? {} : { tier: scope }), ignoreRules }).findings) {
    const block = f.at.startsWith("/blocks/") ? f.at.split("/")[2] : f.at;
    out.push({ key: `${rel}|${f.rule ?? f.code}|${block}`, severity: f.severity ?? "P2", line: `${rel} ${f.at} ${f.severity ?? ""} ${f.code}: ${f.msg}${f.fix ? ` → ${f.fix}` : ""}`.replace(/\s+/g, " ") });
  }
  return out;
}

function readCache(fs: HookFs, file: string): Cache {
  try { const c = JSON.parse(fs.readText(file) ?? "") as Cache; if (c && typeof c === "object" && c.files && Array.isArray(c.pending)) return c; } catch { /* a missing or damaged cache is just empty */ }
  return { files: {}, pending: [] };
}

function render(findings: HookFinding[], extra: string): string {
  const sorted = [...findings].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
  const shown = sorted.slice(0, MAX_LINES).map((f) => `- ${f.line}`);
  let text = `Kages found ${findings.length} new issue(s):\n${shown.join("\n")}${findings.length > MAX_LINES ? `\n- …and ${findings.length - MAX_LINES} more` : ""}\n${extra}`;
  if (text.length > MAX_OUT) text = text.slice(0, MAX_OUT - 1) + "…";
  return text;
}

export async function handleHook(input: HookInput): Promise<HookOutput> {
  try {
    if (input.stdin.length > MAX_STDIN) return silent;
    let payload: Payload;
    try { payload = JSON.parse(input.stdin) as Payload; } catch { return silent; }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return silent;
    const harness: Harness | undefined = detectHarness(payload, input.harness);
    if (!harness) return silent;
    const event: HookEvent | null = (input.event as HookEvent | undefined) ?? harness.event(payload);
    if (!event) return silent;

    const root = input.fs.realpath(typeof payload.cwd === "string" ? payload.cwd : (Array.isArray(payload.workspace_roots) && typeof payload.workspace_roots[0] === "string" ? (payload.workspace_roots[0] as string) : input.cwd));
    if (!root) return silent;
    const wsDir = `${root}/.kages`;
    const cfg = loadConfig({ readFile: (p) => input.fs.readText(p), userFile: `${input.home ?? ""}/.kages/config.json`, workspaceDir: wsDir, env: input.env ?? {} });
    if (cfg.value.hook?.enabled === false) return silent;
    const quiet = cfg.value.hook?.quiet === true;
    const ignoreRules = cfg.value.lint?.ignoreRules ?? [];
    const cacheFile = `${wsDir}/cache/hook.json`;

    // Which Kage files does this event concern, and are they safe to read?
    const safe = (p: string): { rel: string; real: string } | null => {
      const abs = p.startsWith("/") ? p : `${root}/${p}`;
      const real = input.fs.realpath(abs);
      if (!real || !real.endsWith(".kage.json")) return null;
      // A symlink out of the project, or a path under a dependency folder, is not ours to read.
      if (real !== root && !real.startsWith(root + "/")) return null;
      const rel = real.slice(root.length + 1);
      if (SKIP_DIR.test(rel)) return null;
      const size = input.fs.size(real);
      if (size === null || size > MAX_FILE) return null;
      return { rel, real };
    };

    if (event === "pre") {
      const prop = harness.proposed?.(payload);
      if (!prop || !harness.deny) return silent;
      const target = prop.path.endsWith(".kage.json") ? prop.path : null;
      if (!target) return silent;
      const abs = target.startsWith("/") ? target : `${root}/${target}`;
      if (abs !== root && !abs.startsWith(root + "/") || SKIP_DIR.test(abs.slice(root.length + 1)) || abs.includes("/../")) return silent;
      const found = await checkFile(abs.slice(root.length + 1), prop.content, "immediate", ignoreRules);
      // Only a write that cannot be a valid Kage is stopped; lint advice never blocks.
      const errors = found.filter((f) => f.severity === "error");
      return errors.length ? { stdout: harness.deny(render(errors, "Fix the content and write it again.").replace("new issue(s)", "problem(s) that would make this an invalid Kage")), exit: 0 } : silent;
    }

    const cache = readCache(input.fs, cacheFile);
    let touched = false;
    const say: string[] = [];

    if (event === "post") {
      const files = harness.targets(payload).map(safe).filter((x): x is { rel: string; real: string } => !!x);
      if (!files.length) return silent;
      const fresh: HookFinding[] = [], cleanFiles: string[] = [];
      for (const f of files) {
        const text = input.fs.readText(f.real);
        if (text === null) continue;
        const hash = sha(text), prev = cache.files[f.rel];
        if (prev && prev.hash === hash) continue; // unchanged since the last look
        const found = await checkFile(f.rel, text, cfg.value.hook?.perEditRules === "all" ? "all" : "immediate", ignoreRules);
        const seen = new Set(prev?.keys ?? []);
        fresh.push(...found.filter((x) => !seen.has(x.key)));
        // Remember what is present now, so a finding is reported once. Findings that went away drop out, so one
        // that comes back is reported again; the deeper pass keeps its own list.
        cache.files[f.rel] = { hash, keys: [...new Set(found.map((x) => x.key))], ...(prev?.deepKeys ? { deepKeys: prev.deepKeys } : {}) };
        if (!found.length) cleanFiles.push(f.rel);
        if (!cache.pending.includes(f.rel)) cache.pending.push(f.rel);
        touched = true;
      }
      if (fresh.length) say.push(render(fresh, "Run `kages validate <file>` for detail."));
      else if (!quiet && cleanFiles.length) say.push(`Kages: ${cleanFiles.join(", ")} look fine.`);
    } else {
      // stop: the deeper pass over every Kage file edited this session, deduplicated against what the
      // per-edit pass already said.
      const fresh: HookFinding[] = [];
      for (const rel of cache.pending) {
        const s = safe(rel);
        const text = s ? input.fs.readText(s.real) : null;
        if (text === null || !s) continue;
        const found = await checkFile(rel, text, "deep", ignoreRules);
        const prior = cache.files[rel], seen = new Set(prior?.deepKeys ?? []);
        fresh.push(...found.filter((x) => !seen.has(x.key)));
        cache.files[rel] = { hash: sha(text), keys: prior?.keys ?? [], deepKeys: [...new Set(found.map((x) => x.key))] };
      }
      cache.pending = [];
      touched = true;
      if (fresh.length) say.push(render(fresh, "These came from the deeper end-of-turn pass."));
    }

    if (touched) { try { input.fs.ensureRuntimeDir(`${wsDir}/cache`); input.fs.writeText(cacheFile, JSON.stringify(cache)); } catch { /* the cache is a courtesy */ } }
    if (!say.length) return silent;
    const text = say.join("\n");
    const hasProblems = /new issue/.test(text);
    return { stdout: event === "stop" && hasProblems && harness.continueTurn ? harness.continueTurn(text, payload) : harness.addContext(text, event, payload), exit: 0 };
  } catch {
    return silent; // fail open: a hook must never break the agent's turn
  }
}
