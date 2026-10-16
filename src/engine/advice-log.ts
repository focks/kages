// One content-free line per advice/lint call, so rule noise can be measured instead
// of argued about. Content-free BY CONSTRUCTION: an entry is built only from counts,
// rule ids, timings and (opt-in) block ids; there is no field a title, a prop value,
// a comment or the brief could flow into. Pure; sinks live beside the CLI/server.
import type { Advice } from "./advice.ts";
import { diffFindings, findingKey, type AdviceMode, type Severity } from "./regressions.ts";

export interface AdviceLogEntry {
  v: 1;
  ts: string;
  adapter: string;
  principal: string;
  op: string;
  kage?: string;
  version?: number;
  mode: AdviceMode;
  tier: "immediate" | "deep" | "all";
  ms: number;
  counts: Record<Severity, number>;
  rules: string[];
  added: string[];
  resolved: string[];
  waived: string[];
  returned: number;
  suppressed: number;
  policy: { minSeverity: Severity };
  /** Only when the operator opts in: block ids of the findings. Still no text. */
  blocks?: string[];
}

export interface AdviceSink { write(entry: AdviceLogEntry): void }

export interface EntryInput {
  ts: string; adapter: string; principal: string; op: string; kage?: string; version?: number;
  mode: AdviceMode; minSeverity: Severity; ms: number;
  after: readonly Advice[]; before: readonly Advice[] | null; waived: readonly Advice[]; returned: number;
  tier?: AdviceLogEntry["tier"]; logBlockIds?: boolean;
}

const uniq = (xs: string[]) => [...new Set(xs)].sort();
const ruleOf = (f: Advice) => f.rule ?? f.code;
/** A line must stay under 4 KB so one append is atomic on POSIX; the list fields are the only unbounded part. */
const MAX_LIST = 40;
const cap = (xs: string[]) => xs.slice(0, MAX_LIST);

export function entryFor(i: EntryInput): AdviceLogEntry {
  const counts: Record<Severity, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const f of i.after) counts[f.severity ?? "P2"]++;
  const d = i.before === null ? { added: [...i.after], resolved: [] as Advice[] } : diffFindings(i.before, i.after);
  const e: AdviceLogEntry = {
    v: 1, ts: i.ts, adapter: i.adapter, principal: i.principal, op: i.op,
    ...(i.kage ? { kage: i.kage } : {}), ...(i.version !== undefined ? { version: i.version } : {}),
    mode: i.mode, tier: i.tier ?? "immediate", ms: Math.round(i.ms * 10) / 10, counts,
    rules: cap(uniq(i.after.map(ruleOf))), added: cap(uniq(d.added.map(ruleOf))), resolved: cap(uniq(d.resolved.map(ruleOf))), waived: cap(uniq(i.waived.map(ruleOf))),
    returned: i.returned, suppressed: Math.max(0, i.after.length - i.returned), policy: { minSeverity: i.minSeverity },
  };
  if (i.logBlockIds) e.blocks = cap(uniq(i.after.map((f) => findingKey(f).split("|")[1])));
  return e;
}
