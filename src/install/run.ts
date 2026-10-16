// `kages install | update | check | uninstall`: put the skills, slash commands, agents and
// edit hook into the coding harnesses a person uses, and keep an honest record of exactly
// which files that was. The record is what makes update, check and uninstall safe: they act
// only on files the manifest lists, and a file someone edited by hand is reported and left
// alone. Nothing here touches the network; MCP wiring is printed unless explicitly asked for.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ALL_HARNESSES, setupHooks, type InstallResult } from "../hooks/install.ts";
import type { HarnessId } from "../hooks/harnesses.ts";
import { filesFor, HOSTED_MCP, MCP_ADD, SKILL_PROVIDERS, type Planned, type ProviderId } from "./files.ts";
import { VERSION } from "../version.ts";

export type Scope = "project" | "global";
export interface Base { project: string; home: string }
export interface Manifest { version: string; installedAt: string; scope: Scope; providers: string[]; hooks: string[]; files: { path: string; sha256: string }[] }

export const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const manifestFile = (scope: Scope, b: Base) => join(scope === "global" ? b.home : b.project, ".kages", "install.json");

export function readManifest(scope: Scope, b: Base): Manifest | null {
  try { const m = JSON.parse(readFileSync(manifestFile(scope, b), "utf8")) as Manifest; return m && Array.isArray(m.files) ? m : null; } catch { return null; }
}

/** Providers whose configuration directory already exists, i.e. the ones this person uses. */
export function detectProviders(scope: Scope, b: Base): HarnessId[] {
  const root = scope === "global" ? b.home : b.project;
  const has = (...p: string[]) => existsSync(join(root, ...p));
  return ALL_HARNESSES.filter((h) => h === "claude" ? has(".claude") : h === "cursor" ? scope === "project" && has(".cursor") : h === "codex" ? has(".codex") : has(".github", "copilot-instructions.md") || has(".github", "hooks") || has(".copilot"));
}

export type Status = "new" | "same" | "update" | "edited";
export interface PlannedWrite extends Planned { status: Status }

export function planFiles(providers: ProviderId[], scope: Scope, b: Base, manifest: Manifest | null): { writes: PlannedWrite[]; notes: string[] } {
  const recorded = new Map((manifest?.files ?? []).map((f) => [f.path, f.sha256]));
  const writes: PlannedWrite[] = [], notes: string[] = [];
  for (const p of providers) {
    const r = filesFor(p, scope, b);
    notes.push(...r.notes);
    for (const f of r.files) {
      if (!existsSync(f.path)) { writes.push({ ...f, status: "new" }); continue; }
      const cur = readFileSync(f.path, "utf8");
      if (cur === f.content) writes.push({ ...f, status: "same" });
      // A file we wrote and nobody has touched is ours to update; anything else is a person's work.
      else writes.push({ ...f, status: recorded.get(f.path) === sha(cur) ? "update" : "edited" });
    }
  }
  return { writes, notes };
}

export interface InstallOpts {
  scope: Scope; base: Base; providers?: string[]; hooks?: boolean; skills?: boolean; mcp?: "print" | "write";
  yes?: boolean; dryRun?: boolean; force?: boolean; confirm?: (q: string) => Promise<boolean>; now?: () => number;
}
export interface Outcome { lines: string[]; exit: number; changed: string[] }

const atomic = (file: string, text: string) => { mkdirSync(dirname(file), { recursive: true }); const t = `${file}.${process.pid}.tmp`; writeFileSync(t, text); renameSync(t, file); };

function emptyDirsUp(file: string, stop: string): void {
  for (let d = dirname(file); d.startsWith(stop) && d !== stop; d = dirname(d)) { try { if (readdirSync(d).length) return; rmdirSync(d); } catch { return; } }
}

export async function install(o: InstallOpts, existing: Manifest | null = readManifest(o.scope, o.base)): Promise<Outcome> {
  const lines: string[] = [];
  const detected = detectProviders(o.scope, o.base);
  const chosen = (o.providers?.length ? o.providers : existing?.providers?.length ? existing.providers : detected) as string[];
  for (const p of chosen) if (!ALL_HARNESSES.includes(p as HarnessId)) return { lines: [`unknown provider '${p}' (${ALL_HARNESSES.join(", ")}; grok has no verified format yet)`], exit: 1, changed: [] };
  if (!chosen.length) return { lines: [`no coding harness found in ${o.scope === "global" ? "your home directory" : "this project"} (looked for .claude, .cursor, .codex, .github/copilot-instructions.md). Name one: kages install --providers claude`], exit: 0, changed: [] };
  lines.push(`providers: ${chosen.join(", ")}${o.providers?.length ? "" : existing?.providers?.length ? " (from the last install)" : " (detected)"} · scope: ${o.scope}`);

  const withSkills = o.skills !== false;
  const { writes, notes } = withSkills ? planFiles(chosen.filter((c): c is ProviderId => SKILL_PROVIDERS.includes(c as ProviderId)), o.scope, o.base, existing) : { writes: [] as PlannedWrite[], notes: [] as string[] };
  lines.push(...notes);
  const todo = writes.filter((w) => w.status === "new" || w.status === "update" || (w.status === "edited" && o.force));
  const kept = writes.filter((w) => w.status === "edited" && !o.force);
  const tally = (s: Status) => writes.filter((w) => w.status === s).length;
  if (withSkills) lines.push(`files: ${tally("new")} new, ${tally("update")} to update, ${tally("same")} already current${kept.length ? `, ${kept.length} edited by hand (kept; --force overwrites)` : ""}`);
  for (const w of todo.slice(0, 40)) lines.push(`  ${w.status === "new" ? "+" : "~"} ${w.path}`);
  if (todo.length > 40) lines.push(`  … and ${todo.length - 40} more`);
  for (const w of kept) lines.push(`  ! kept your edited ${w.path}`);

  const hookIds = (o.hooks === false ? [] : chosen.filter((c) => ALL_HARNESSES.includes(c as HarnessId))) as HarnessId[];
  let hookPlan: InstallResult | null = null;
  if (hookIds.length) {
    hookPlan = await setupHooks({ harnesses: hookIds, scope: o.scope, projectDir: o.base.project, homeDir: o.base.home, dryRun: true });
    lines.push("hooks:", ...hookPlan.lines.map((l) => "  " + l));
  }
  const mcpFile = join(o.scope === "global" ? o.base.home : o.base.project, o.scope === "global" ? ".claude.json" : ".mcp.json");
  const mcpPending = o.mcp === "write" && chosen.includes("claude") && !/"kages"\s*:/.test(existsSync(mcpFile) ? readFileSync(mcpFile, "utf8") : "");
  const nothing = !todo.length && !mcpPending && (!hookPlan || hookPlan.lines.includes("nothing to change"));
  if (nothing && !o.dryRun) { lines.push("nothing to change"); return { lines, exit: 0, changed: [] }; }
  if (o.dryRun) return { lines: [...lines, "dry run: nothing was written"], exit: 0, changed: [] };
  if (!o.yes) {
    if (!o.confirm) return { lines: [...lines, "not writing anything without consent: re-run in a terminal, or pass --yes"], exit: 0, changed: [] };
    if (!(await o.confirm("Install these files and hooks?"))) return { lines: [...lines, "no changes made"], exit: 0, changed: [] };
  }

  const changed: string[] = [];
  const files = new Map((existing?.files ?? []).map((f) => [f.path, f.sha256]));
  for (const w of todo) { atomic(w.path, w.content); files.set(w.path, sha(w.content)); changed.push(w.path); }
  for (const w of writes.filter((x) => x.status === "same")) files.set(w.path, sha(w.content));
  let hookIdsDone: string[] = existing?.hooks ?? [];
  if (hookIds.length) {
    const r = await setupHooks({ harnesses: hookIds, scope: o.scope, projectDir: o.base.project, homeDir: o.base.home, yes: true, force: o.force });
    if (r.exit !== 0) lines.push(...r.lines); else { lines.push(...r.lines.filter((l) => /^installed|^To skip/.test(l))); changed.push(...r.changed); hookIdsDone = [...new Set([...hookIdsDone, ...hookIds])]; }
  }
  if (o.mcp === "write" && chosen.includes("claude")) {
    const file = mcpFile;
    let json: Record<string, unknown> = {};
    try { if (existsSync(file)) json = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>; } catch { lines.push(`${file} is not valid JSON; left alone. Add the server yourself: ${MCP_ADD.claude}`); json = {}; }
    const servers = (json.mcpServers ?? {}) as Record<string, unknown>;
    if (!servers.kages && !lines.some((l) => l.includes("left alone"))) { atomic(file, JSON.stringify({ ...json, mcpServers: { ...servers, kages: { command: "kages", args: ["mcp"] } } }, null, 2) + "\n"); lines.push(`added the kages MCP server to ${file}`); changed.push(file); }
  }
  const manifest: Manifest = { version: VERSION, installedAt: new Date((o.now ?? Date.now)()).toISOString(), scope: o.scope, providers: [...new Set(chosen)], hooks: hookIdsDone, files: [...files].map(([path, sha256]) => ({ path, sha256 })).sort((a, b) => a.path.localeCompare(b.path)) };
  atomic(manifestFile(o.scope, o.base), JSON.stringify(manifest, null, 2) + "\n");
  lines.push(`installed Kages ${VERSION}: ${changed.length} file(s) written`);
  if (o.mcp !== "write") for (const p of chosen.filter((c) => MCP_ADD[c])) lines.push(`wire the tools: ${MCP_ADD[p]}   (or the hosted server: ${HOSTED_MCP})`);
  lines.push("next: kages init   ·   kages doctor");
  return { lines, exit: 0, changed };
}

export interface CheckResult { ok: boolean; lines: string[]; exit: number }

/** Is what is installed present and current? Offline. Exit 1 when it is missing or older than this CLI. */
export function check(scope: Scope, b: Base): CheckResult {
  const m = readManifest(scope, b);
  if (!m) return { ok: false, exit: 1, lines: [`Kages is not installed (${scope} scope): run kages install`] };
  const lines: string[] = [], problems: string[] = [];
  if (m.version !== VERSION) problems.push(`installed ${m.version}, this CLI is ${VERSION}: run kages update`);
  for (const f of m.files) {
    if (!existsSync(f.path)) problems.push(`missing: ${f.path}`);
    else if (sha(readFileSync(f.path, "utf8")) !== f.sha256) lines.push(`edited by hand: ${f.path} (update will not overwrite it)`);
  }
  if (problems.length) return { ok: false, exit: 1, lines: [...problems, ...lines] };
  return { ok: true, exit: 0, lines: [`Kages ${m.version} is installed and current (${m.files.length} files, ${m.providers.join(", ")})`, ...lines] };
}

export async function uninstall(o: { scope: Scope; base: Base; yes?: boolean; confirm?: (q: string) => Promise<boolean> }): Promise<Outcome> {
  const m = readManifest(o.scope, o.base);
  if (!m) return { lines: ["nothing recorded as installed"], exit: 0, changed: [] };
  const mine = m.files.filter((f) => existsSync(f.path) && sha(readFileSync(f.path, "utf8")) === f.sha256);
  const edited = m.files.filter((f) => existsSync(f.path) && !mine.includes(f));
  const lines = [`will remove ${mine.length} file(s)${edited.length ? `, keep ${edited.length} you edited` : ""}${m.hooks.length ? ` and the hooks for ${m.hooks.join(", ")}` : ""}`];
  if (!o.yes) { if (!o.confirm) return { lines: [...lines, "pass --yes to proceed"], exit: 0, changed: [] }; if (!(await o.confirm("Remove them?"))) return { lines: [...lines, "no changes made"], exit: 0, changed: [] }; }
  const root = o.scope === "global" ? o.base.home : o.base.project, changed: string[] = [];
  for (const f of mine) { rmSync(f.path, { force: true }); changed.push(f.path); emptyDirsUp(f.path, root); }
  for (const f of edited) lines.push(`kept ${f.path} (edited by hand)`);
  if (m.hooks.length) { const r = await setupHooks({ harnesses: m.hooks as HarnessId[], scope: o.scope, projectDir: o.base.project, homeDir: o.base.home, yes: true, uninstall: true }); changed.push(...r.changed); }
  rmSync(manifestFile(o.scope, o.base), { force: true });
  lines.push(`removed ${changed.length} file(s)`);
  return { lines, exit: 0, changed };
}
