// Which findings a change introduced, kept or fixed. Advice on success reports
// only what is NEW against the previous version (otherwise every small patch would
// repeat the same known findings and agents would learn to ignore all of it), and a
// dry run uses the same comparison. Findings are matched by rule and block, not by
// message text or full pointer, so a finding that merely moved within its block, or
// whose wording changed, is not "new".
import type { Advice } from "./advice.ts";

const blockOf = (at: string): string => (at.startsWith("/blocks/") ? at.split("/")[2] ?? at : at);
export const findingKey = (f: Advice): string => `${f.rule ?? f.code}|${blockOf(f.at)}`;

export interface FindingDiff { added: Advice[]; resolved: Advice[]; unchanged: Advice[] }

export function diffFindings(before: readonly Advice[], after: readonly Advice[]): FindingDiff {
  const had = new Map<string, Advice>();
  for (const f of before) if (!had.has(findingKey(f))) had.set(findingKey(f), f);
  const now = new Set<string>();
  const added: Advice[] = [], unchanged: Advice[] = [];
  for (const f of after) {
    now.add(findingKey(f));
    (had.has(findingKey(f)) ? unchanged : added).push(f);
  }
  const resolved = [...had].filter(([k]) => !now.has(k)).map(([, f]) => f);
  return { added, resolved, unchanged };
}

/** Block-level summary of what a change did, for a dry run's `diff`. */
export function blockDiff(before: { blocks?: Record<string, unknown> }, after: { blocks?: Record<string, unknown> }): { added: string[]; removed: string[]; changed: string[] } {
  const a = before.blocks ?? {}, b = after.blocks ?? {};
  return {
    added: Object.keys(b).filter((id) => !(id in a)).sort(),
    removed: Object.keys(a).filter((id) => !(id in b)).sort(),
    changed: Object.keys(b).filter((id) => id in a && JSON.stringify(a[id]) !== JSON.stringify(b[id])).sort(),
  };
}

// --- what a successful write tells the author ---------------------------------

export type AdviceMode = "full" | "quiet" | "off";
export type Severity = "P0" | "P1" | "P2" | "P3";
export interface AdvicePolicy { mode: AdviceMode; /** the quiet-mode floor */ minSeverity: Severity; /** also return findings that were already there */ all?: boolean }
export const DEFAULT_POLICY: AdvicePolicy = { mode: "full", minSeverity: "P2" };

const RANK: Record<Severity, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
/** A hint (about a validator warning) carries no severity; it counts as P2. */
const rank = (f: Advice): number => RANK[f.severity ?? "P2"];

export interface SuccessAdvice {
  /** What the author should look at: for a patch, only what this patch introduced. */
  advice?: Advice[];
  /** `full` mode with nothing to report says so, so silence is never ambiguous. */
  ack?: "clean";
  /** Findings this change fixed (full mode). */
  resolved?: number;
  /** Findings that were already present and are not repeated (full mode). */
  existing?: number;
}

/** `before` is null for a first version (everything is new). Failing writes never
 *  come through here: errors and their advice are always returned in full. */
export function adviceOnSuccess(before: readonly Advice[] | null, after: readonly Advice[], policy: AdvicePolicy = DEFAULT_POLICY): SuccessAdvice {
  if (policy.mode === "off") return {};
  const d = before === null ? { added: [...after], resolved: [], unchanged: [] as Advice[] } : diffFindings(before, after);
  const reported = policy.all || before === null ? [...after] : d.added;
  const shown = policy.mode === "quiet" ? reported.filter((f) => rank(f) <= RANK[policy.minSeverity]) : reported;
  const out: SuccessAdvice = {};
  if (shown.length) out.advice = shown;
  else if (policy.mode === "full") out.ack = "clean";
  if (policy.mode === "full") {
    if (d.resolved.length) out.resolved = d.resolved.length;
    if (before !== null && !policy.all && d.unchanged.length) out.existing = d.unchanged.length;
  }
  return out;
}

export function parsePolicy(p: { advice?: unknown; minSeverity?: unknown; all?: unknown }, fallback: AdvicePolicy = DEFAULT_POLICY): AdvicePolicy {
  const mode = p.advice === "full" || p.advice === "quiet" || p.advice === "off" ? p.advice : fallback.mode;
  const sev = typeof p.minSeverity === "string" && p.minSeverity in RANK ? (p.minSeverity as Severity) : fallback.minSeverity;
  return { mode, minSeverity: sev, ...(p.all === true ? { all: true } : {}) };
}
