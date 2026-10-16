// `kages advice-log stats|tail`: read the audit log back. The headline is the
// waiver rate per rule: a rule people keep waiving is a false-positive candidate.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AdviceLogEntry } from "../engine/advice-log.ts";
import { out, printJson } from "./format.ts";

export function readLog(path: string): { entries: AdviceLogEntry[]; skipped: number } {
  if (!existsSync(path)) return { entries: [], skipped: 0 };
  const entries: AdviceLogEntry[] = [];
  let skipped = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { const e = JSON.parse(line) as AdviceLogEntry; if (e && e.v === 1) entries.push(e); else skipped++; } catch { skipped++; }
  }
  return { entries, skipped };
}

const pct = (xs: number[], q: number) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

export interface Stats {
  calls: number; since: string | null;
  writes: number; writesWithRegressions: number; regressionRate: number;
  ms: { p50: number; p95: number };
  modes: Record<string, number>; ops: Record<string, number>;
  rules: { rule: string; findings: number; waived: number; waiverRate: number; introduced: number }[];
}

export function statsOf(entries: AdviceLogEntry[], days?: number, now = Date.now()): Stats {
  const cutoff = days ? now - days * 86_400_000 : 0;
  const es = entries.filter((e) => Date.parse(e.ts) >= cutoff);
  const per = new Map<string, { findings: number; waived: number; introduced: number }>();
  const bump = (r: string, k: "findings" | "waived" | "introduced") => { const x = per.get(r) ?? { findings: 0, waived: 0, introduced: 0 }; x[k]++; per.set(r, x); };
  const modes: Record<string, number> = {}, ops: Record<string, number> = {};
  for (const e of es) {
    modes[e.mode] = (modes[e.mode] ?? 0) + 1; ops[e.op] = (ops[e.op] ?? 0) + 1;
    for (const r of e.rules) bump(r, "findings");
    for (const r of e.waived) bump(r, "waived");
    for (const r of e.added) bump(r, "introduced");
  }
  const writes = es.filter((e) => /^(create|patch|generate)_kage$|^set_kage_brief$/.test(e.op));
  const withReg = writes.filter((e) => e.added.length > 0).length;
  return {
    calls: es.length, since: es[0]?.ts ?? null, writes: writes.length, writesWithRegressions: withReg, regressionRate: writes.length ? withReg / writes.length : 0,
    ms: { p50: pct(es.map((e) => e.ms), 0.5), p95: pct(es.map((e) => e.ms), 0.95) }, modes, ops,
    rules: [...per].map(([rule, v]) => ({ rule, ...v, waiverRate: v.findings + v.waived ? v.waived / (v.findings + v.waived) : 0 })).sort((a, b) => b.waiverRate - a.waiverRate || b.findings - a.findings),
  };
}

export function adviceLogCmd(rest: string[], flags: Record<string, unknown>, defaultPath: string): number {
  const sub = rest[0] ?? "stats";
  const path = typeof flags.path === "string" ? flags.path : defaultPath;
  const { entries, skipped } = readLog(path);
  if (sub === "tail") {
    const n = typeof flags.n === "number" ? flags.n : 20;
    const tail = entries.slice(-n);
    if (flags.json) printJson(tail); else for (const e of tail) out(`${e.ts} ${e.adapter.padEnd(4)} ${e.op.padEnd(15)} ${(e.kage ?? "-").padEnd(18)} P0:${e.counts.P0} P1:${e.counts.P1} P2:${e.counts.P2} P3:${e.counts.P3} new:[${e.added.join(",")}] returned:${e.returned} ${e.ms}ms`);
    if (!entries.length) out(`no entries in ${path}`);
    return 0;
  }
  if (sub !== "stats") throw new Error("usage: kages advice-log stats [--days 7] [--path p] | tail [-n 20] [--json]");
  const s = statsOf(entries, typeof flags.days === "number" ? flags.days : 7);
  if (flags.json) { printJson({ ...s, skippedLines: skipped, path }); return 0; }
  if (!s.calls) { out(`no entries in ${path}. Turn the log on: kages config set advice.auditLog true`); return 0; }
  out(`${s.calls} call(s) in the last ${flags.days ?? 7} day(s) · ${s.writes} write(s), ${Math.round(s.regressionRate * 100)}% introduced a finding · p50 ${s.ms.p50}ms, p95 ${s.ms.p95}ms`);
  out(`modes: ${Object.entries(s.modes).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  out("\nrule                      found  waived  waiver-rate  introduced");
  for (const r of s.rules) out(`${r.rule.padEnd(25)} ${String(r.findings).padStart(5)} ${String(r.waived).padStart(7)}  ${(Math.round(r.waiverRate * 100) + "%").padStart(10)} ${String(r.introduced).padStart(11)}${r.waiverRate >= 0.5 && r.waived >= 3 ? "   ← often waived: false-positive candidate" : ""}`);
  if (skipped) out(`\n(${skipped} unreadable line(s) skipped)`);
  void join;
  return 0;
}
