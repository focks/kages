// The one-call session boot: what an agent should know before it touches a
// workspace or a Kage, and what is missing. Pure: the store layer gathers plain
// inputs, this shapes them, derives the directives and fits the result to a size
// budget. Everything is derived from existing data (no new storage). Brief text,
// comments and findings are untrusted content, so the text rendering fences them
// exactly as describe_kage does.
import type { Advice } from "./advice.ts";
import type { KageBrief, Mode, WorkspaceBrief } from "./types.ts";

/** The part of a named rule the context carries (the full shape lives in src/packs). */
export interface ContextRule { id: string; name: string; statement: string }

export interface Directive { code: string; severity: "info" | "warn"; message: string; command?: string }

export interface ContextInputs {
  workspace: { name: string; repos: { repo: string; count: number }[]; kages: number };
  /** `visible:false` = the caller may not read the brief (anonymous): it is neither shown nor reported missing. */
  brief: { visible: boolean; record: { brief: WorkspaceBrief; revision: number } | null };
  system?: { id: string; version: string; summary: string; rules: ContextRule[]; tokensDigest: string; cardRef: string };
  kage?: {
    name: string; version: number; state: string; blocks: number;
    brief?: KageBrief; modeGuess: { mode: Mode; confidence: "low" | "medium" };
    validation: { errors: number; warnings: number };
    findings: Advice[];
    /** The system version the Kage was resolved against, vs the one installed now. */
    pinnedSystem?: string; currentSystem?: string;
    comments: { open: number; threads: number };
    /** Uses of deprecated props, roles or values in this Kage. */
    deprecatedUses?: number;
    /** Claims in this Kage that nothing on record supports (persuade and experience only). */
    unsourcedClaims?: number;
    latestCritique?: { id: string; score: number; max: number; open: { P0: number; P1: number }; stale: boolean };
  };
  full?: boolean;
}

export interface Context {
  version: 1;
  workspace: ContextInputs["workspace"];
  brief: { workspace: WorkspaceBrief | null; revision?: number; kage?: KageBrief | null; modeSource?: "declared" | "inferred"; mode?: Mode };
  system?: ContextInputs["system"];
  kage?: {
    name: string; version: number; state: string; blocks: number; validation: { errors: number; warnings: number };
    findings: { P0: number; P1: number; P2: number; P3: number; top: Advice[] };
    latestCritique?: NonNullable<ContextInputs["kage"]>["latestCritique"];
    comments?: { open: number; threads: number };
  };
  directives: Directive[];
  budget: { chars: number; truncated: boolean };
}

export const CONTEXT_BUDGET = 6000;
export const LARGE_WORKSPACE = 200;
const SEV = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

export function directivesFor(i: ContextInputs): Directive[] {
  const out: Directive[] = [];
  const b = i.brief.record?.brief;
  if (i.brief.visible && !b) out.push({ code: "NO_BRIEF", severity: "warn", message: "This workspace has no brief. Until one exists, do not invent audience, claims, customers or numbers.", command: "kages init   (or call set_brief)" });
  if (b?.inferred?.length) out.push({ code: "BRIEF_UNCONFIRMED", severity: "info", message: `These brief fields were filled in by an agent and are unconfirmed: ${b.inferred.join(", ")}. Ask the owner to confirm them.`, command: "kages brief show" });
  const k = i.kage;
  if (k) {
    if (!k.brief?.mode) out.push({ code: "NO_MODE", severity: "info", message: `This Kage declares no mode; it looks like "${k.modeGuess.mode}" (${k.modeGuess.confidence} confidence). Declare it so mode-aware checks apply.`, command: `set_kage_brief {"name":"${k.name}","brief":{"mode":"${k.modeGuess.mode}"}}` });
    if (k.validation.errors > 0) out.push({ code: "VALIDATION_ERRORS", severity: "warn", message: `${k.validation.errors} validation error(s); the Kage cannot be published.`, command: `kages validate ${k.name}` });
    const count = (s: "P0" | "P1") => k.findings.filter((f) => f.severity === s).length;
    for (const s of ["P0", "P1"] as const) {
      const n = count(s);
      if (n) out.push({ code: `LINT_${s}`, severity: "warn", message: `${n} ${s} finding(s) to fix before publishing: ${[...new Set(k.findings.filter((f) => f.severity === s).map((f) => f.code))].slice(0, 4).join(", ")}.`, command: `kages lint ${k.name}` });
    }
    if (k.unsourcedClaims && (k.brief?.mode ?? k.modeGuess.mode) !== "read" && (k.brief?.mode ?? k.modeGuess.mode) !== "operate") out.push({ code: "UNSOURCED_CLAIMS", severity: "warn", message: `${k.unsourcedClaims} figure(s), count(s) or quote(s) have no source on record. Source them in the Kage brief, bind them to data, label the page illustrative, or remove them.`, command: `kages lint ${k.name}` });
    if (k.deprecatedUses) out.push({ code: "DEPRECATED_USED", severity: "info", message: `${k.deprecatedUses} use(s) of deprecated features. They still render, but new work should use the replacements.`, command: `kages migrate ${k.name}` });
    const c = k.latestCritique;
    if (c?.stale) out.push({ code: "CRITIQUE_STALE", severity: "info", message: `The latest critique (${c.score}/${c.max}) predates the current version.`, command: `kages improve critique ${k.name}` });
    else if (c && (c.open.P0 || c.open.P1)) out.push({ code: "CRITIQUE_OPEN", severity: "warn", message: `The latest critique has ${c.open.P0} open P0 and ${c.open.P1} open P1 issue(s).`, command: `kages improve polish ${k.name}` });
    if (k.pinnedSystem && k.currentSystem && k.pinnedSystem !== k.currentSystem) out.push({ code: "SYSTEM_MISMATCH", severity: "info", message: `This Kage was built on ${k.pinnedSystem}; ${k.currentSystem} is installed now. It still renders as built.`, command: "kages doctor" });
  }
  if (i.workspace.kages > LARGE_WORKSPACE) out.push({ code: "LARGE_WORKSPACE", severity: "info", message: `${i.workspace.kages} Kages here; use search_kages before listing.` });
  return out;
}

export function buildContext(i: ContextInputs): Context {
  const ctx: Context = {
    version: 1,
    workspace: { ...i.workspace, repos: [...i.workspace.repos] },
    brief: { workspace: i.brief.visible ? i.brief.record?.brief ?? null : null, ...(i.brief.record && i.brief.visible ? { revision: i.brief.record.revision } : {}) },
    directives: directivesFor(i),
    budget: { chars: 0, truncated: false },
  };
  if (i.system) ctx.system = { ...i.system, rules: [...i.system.rules] };
  if (i.kage) {
    const k = i.kage;
    const sorted = [...k.findings].sort((a, b) => SEV[a.severity ?? "P3"] - SEV[b.severity ?? "P3"]);
    const n = (s: keyof typeof SEV) => k.findings.filter((f) => (f.severity ?? "P3") === s).length;
    ctx.kage = { name: k.name, version: k.version, state: k.state, blocks: k.blocks, validation: k.validation, findings: { P0: n("P0"), P1: n("P1"), P2: n("P2"), P3: n("P3"), top: sorted.slice(0, 5) }, ...(k.latestCritique ? { latestCritique: k.latestCritique } : {}), comments: k.comments };
    ctx.brief.kage = k.brief ?? null;
    ctx.brief.mode = k.brief?.mode ?? k.modeGuess.mode;
    ctx.brief.modeSource = k.brief?.mode ? "declared" : "inferred";
  }
  return i.full ? finish(ctx, false) : fitToBudget(ctx, CONTEXT_BUDGET);
}

const size = (c: Context) => JSON.stringify(c).length;
// Measured with a five-digit placeholder, so the reported figure is never below the real
// JSON length and "within budget" is a true statement about what is sent.
function finish(c: Context, truncated: boolean): Context { c.budget = { chars: 99999, truncated }; c.budget.chars = size(c); return c; }

/** Trim in a fixed order until it fits: top findings, comments, system rules, then
 *  the repo list. The order is part of the contract (tested), so output is stable. */
export function fitToBudget(c: Context, chars: number): Context {
  const steps: Array<() => boolean> = [
    () => { if (c.kage && c.kage.findings.top.length > 2) { c.kage.findings.top = c.kage.findings.top.slice(0, 2); return true; } return false; },
    () => { if (c.kage && c.kage.findings.top.length) { c.kage.findings.top = []; return true; } return false; },
    () => { if (c.kage?.comments) { delete c.kage.comments; return true; } return false; },
    () => { if (c.system && c.system.rules.length > 3) { c.system.rules = c.system.rules.slice(0, 3); return true; } return false; },
    () => { if (c.system && c.system.rules.length) { c.system.rules = []; return true; } return false; },
    () => { if (c.workspace.repos.length > 5) { c.workspace.repos = c.workspace.repos.slice(0, 5); return true; } return false; },
    () => { if (c.workspace.repos.length) { c.workspace.repos = []; return true; } return false; },
  ];
  let truncated = false;
  finish(c, false);
  for (const step of steps) { if (c.budget.chars <= chars) break; if (step()) { truncated = true; finish(c, true); } }
  // Briefs can be valid yet exceed the entire session budget. Shorten optional
  // content first; constraints and prohibitions are the last brief fields trimmed.
  const shrink = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    const o = value as Record<string, unknown>;
    for (const key of Object.keys(o)) {
      const v = o[key];
      if (typeof v === "string" && v.length > 80) { o[key] = v.slice(0, Math.max(80, Math.floor(v.length / 2))) + "…"; return true; }
      if (Array.isArray(v) && v.length > 1) { v.pop(); return true; }
      if (shrink(v)) return true;
    }
    return false;
  };
  const briefOrder = ["evidence", "notes", "useScene", "positioning", "voice", "operatingContext", "brandCommitments", "openDecisions", "principles", "audience", "job", "primaryAction", "users", "purpose", "constraints", "absent"];
  while (c.budget.chars > chars) {
    let changed = false;
    for (const key of briefOrder) {
      for (const brief of [c.brief.workspace, c.brief.kage]) {
        if (!brief || !(key in brief)) continue;
        const holder = { [key]: (brief as unknown as Record<string, unknown>)[key] };
        if (shrink(holder)) { (brief as unknown as Record<string, unknown>)[key] = holder[key]; changed = true; break; }
      }
      if (changed) break;
    }
    if (!changed) changed = shrink(c.directives) || shrink(c.system) || shrink(c.workspace);
    if (!changed) throw new RangeError("context budget is too small for required metadata");
    truncated = true;
    finish(c, true);
  }
  return finish(c, truncated);
}

const fence = (s: string) => `<kage-content untrusted="true">\n${s}\n</kage-content>`;

/** Stable, line-oriented rendering for the CLI and for agents that read text.
 *  Anything a person or another agent wrote is inside a data fence. */
export function renderContextText(c: Context): string {
  const L: string[] = [`Workspace ${c.workspace.name}: ${c.workspace.kages} Kage(s)${c.workspace.repos.length ? " in " + c.workspace.repos.map((r) => `${r.repo} (${r.count})`).join(", ") : ""}`];
  const b = c.brief.workspace;
  L.push("", "Brief" + (c.brief.revision ? ` (revision ${c.brief.revision})` : ""));
  if (b) {
    const parts: string[] = [`users: ${b.users}`, `purpose: ${b.purpose}`];
    for (const k of ["positioning", "voice", "operatingContext", "brandCommitments"] as const) if (b[k]) parts.push(`${k}: ${b[k]}`);
    for (const k of ["constraints", "absent", "principles", "openDecisions"] as const) if (b[k]?.length) parts.push(`${k}: ${b[k]!.join("; ")}`);
    L.push(fence(parts.join("\n")));
  } else L.push("  (none)");
  if (c.system) { L.push("", `System ${c.system.id}@${c.system.version}: ${c.system.summary}`, `  card: ${c.system.cardRef}  tokens: ${c.system.tokensDigest}`); for (const r of c.system.rules) L.push(`  - ${r.name}: ${r.statement}`); }
  if (c.kage) {
    const k = c.kage;
    L.push("", `Kage ${k.name} v${k.version} (${k.state}, ${k.blocks} blocks): ${k.validation.errors} error(s), ${k.validation.warnings} warning(s)`);
    if (c.brief.mode) L.push(`  mode: ${c.brief.mode} (${c.brief.modeSource})`);
    L.push(`  findings: P0 ${k.findings.P0}, P1 ${k.findings.P1}, P2 ${k.findings.P2}, P3 ${k.findings.P3}`);
    if (k.findings.top.length) L.push(fence(k.findings.top.map((f) => `${f.severity} ${f.at} ${f.code}: ${f.msg}`).join("\n")));
    if (k.comments) L.push(`  comments: ${k.comments.open} open in ${k.comments.threads} thread(s)`);
    if (k.latestCritique) L.push(`  critique: ${k.latestCritique.score}/${k.latestCritique.max}${k.latestCritique.stale ? " (stale)" : ""}`);
  }
  L.push("", c.directives.length ? "Directives" : "Directives: none");
  for (const d of c.directives) L.push(`  [${d.severity}] ${d.code}: ${d.message}${d.command ? `\n        run: ${d.command}` : ""}`);
  if (c.budget.truncated) L.push("", `Briefs and other context may be partial; fetch get_brief or full context before acting on constraints. (trimmed to ${c.budget.chars} chars; pass full to see everything)`);
  return L.join("\n");
}
