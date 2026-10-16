// Persisted critiques: the saved result of a design review, tied to the exact
// version it judged. The store keeps the scores, a prioritised backlog and the
// report; it never produces them (Kages calls no model). Everything the client
// sends is validated, and totals are recomputed here so a client cannot inflate a
// score. The report body is untrusted text, like any Kage content.
import { isImproveCommand } from "../engine/improve.ts";
import type { KageDoc } from "../engine/types.ts";

export type Sev = "P0" | "P1" | "P2" | "P3";
export type CritiqueMethod = "dual-agent" | "degraded" | "single";
export type PriorityStatus = "open" | "fixed" | "wontfix";

export interface Priority { sev: Sev; title: string; why?: string; fix: string; command?: string; block?: string; status: PriorityStatus }

export interface Critique {
  id: string;
  kage: string; version: number;
  /** The head digest when it was assessed: the Kage has changed since if this no longer matches. */
  fingerprint: string;
  createdAt: string; author: string;
  method: CritiqueMethod; degradedReason?: string;
  scores: Record<string, number | null>;
  naReasons?: Record<string, string>;
  total: number; max: number;
  counts: Record<Sev, number>;
  priorities: Priority[];
  body: string;
  state: "open" | "closed"; closedAt?: string; closedBy?: string; closedReason?: string;
}

export const HEURISTIC_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;
export const MIN_SCORED = 3;
export const MAX_PRIORITIES = 8;
export const MAX_BODY = 20 * 1024;
export const MAX_PER_KAGE = 50;
export const MAX_SAVES_PER_HOUR = 20;
const SEVS: readonly string[] = ["P0", "P1", "P2", "P3"];

export interface CritiqueInput {
  fingerprint?: string; scores: unknown; naReasons?: unknown; priorities?: unknown; body?: unknown; method?: unknown; degradedReason?: unknown;
}
export type Checked = { ok: true; value: Pick<Critique, "scores" | "naReasons" | "priorities" | "body" | "method" | "degradedReason" | "total" | "max" | "counts"> } | { ok: false; errors: string[] };

const NUL = "\u0000";
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length <= max && !v.includes(NUL) ? v : null);

/** Validate untrusted input and compute the totals. `doc` (the judged version) lets block references be checked. */
export function validateCritique(input: CritiqueInput, doc?: KageDoc): Checked {
  const errors: string[] = [];
  const raw = input.scores && typeof input.scores === "object" && !Array.isArray(input.scores) ? (input.scores as Record<string, unknown>) : null;
  if (!raw) return { ok: false, errors: ["scores must be an object keyed 1 to 10"] };
  const na = input.naReasons && typeof input.naReasons === "object" && !Array.isArray(input.naReasons) ? (input.naReasons as Record<string, unknown>) : {};
  const scores: Record<string, number | null> = {}, naReasons: Record<string, string> = {};
  let total = 0, scored = 0;
  for (const k of Object.keys(raw)) if (!(HEURISTIC_KEYS as readonly string[]).includes(k)) errors.push(`unknown heuristic "${k}" (use 1 to 10)`);
  for (const k of HEURISTIC_KEYS) {
    const v = raw[k];
    if (v === undefined) continue;
    if (v === null) {
      const r = str(na[k], 300);
      if (!r || r.trim() === "") errors.push(`heuristic ${k} is n/a but has no reason in naReasons`);
      else { scores[k] = null; naReasons[k] = r.trim(); }
    } else if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 4) { scores[k] = v; total += v; scored++; }
    else errors.push(`heuristic ${k} must be an integer 0 to 4, or null with a reason`);
  }
  if (scored < MIN_SCORED && !errors.length) errors.push(`score at least ${MIN_SCORED} heuristics; n/a everywhere is not a critique`);

  const method = input.method ?? "single";
  if (method !== "dual-agent" && method !== "degraded" && method !== "single") errors.push('method must be "dual-agent", "degraded" or "single"');
  let degradedReason: string | undefined;
  if (method === "degraded") { const r = str(input.degradedReason, 300); if (!r || r.trim() === "") errors.push("a degraded critique must say why in degradedReason"); else degradedReason = r.trim(); }

  const body = input.body === undefined ? "" : str(input.body, MAX_BODY);
  if (body === null) errors.push(`body must be text of at most ${MAX_BODY / 1024} KB without NUL`);

  const priorities: Priority[] = [];
  if (input.priorities !== undefined) {
    if (!Array.isArray(input.priorities)) errors.push("priorities must be a list");
    else {
      if (input.priorities.length > MAX_PRIORITIES) errors.push(`at most ${MAX_PRIORITIES} priorities`);
      input.priorities.forEach((p, i) => {
        const o = p as Record<string, unknown> | null;
        if (!o || typeof o !== "object") return void errors.push(`priority ${i + 1} must be an object`);
        if (typeof o.sev !== "string" || !SEVS.includes(o.sev)) errors.push(`priority ${i + 1}: sev must be P0, P1, P2 or P3`);
        const title = str(o.title, 140), fix = str(o.fix, 500);
        if (!title || title.trim() === "") errors.push(`priority ${i + 1}: a title of at most 140 characters is required`);
        if (!fix || fix.trim() === "") errors.push(`priority ${i + 1}: a fix is required`);
        const why = o.why === undefined ? undefined : str(o.why, 500);
        if (o.why !== undefined && why === null) errors.push(`priority ${i + 1}: why is too long`);
        if (o.command !== undefined && o.command !== "" && !isImproveCommand(o.command)) errors.push(`priority ${i + 1}: command "${String(o.command)}" is not an improve command`);
        const block = o.block === undefined || o.block === "" ? undefined : str(o.block, 120);
        if (o.block !== undefined && o.block !== "" && block === null) errors.push(`priority ${i + 1}: block is invalid`);
        if (block && doc && !doc.blocks[block]) errors.push(`priority ${i + 1}: there is no block "${block}" in the version that was judged`);
        const status = o.status === undefined ? "open" : o.status;
        if (status !== "open" && status !== "fixed" && status !== "wontfix") errors.push(`priority ${i + 1}: status must be open, fixed or wontfix`);
        if (title && fix && typeof o.sev === "string" && SEVS.includes(o.sev) && (status === "open" || status === "fixed" || status === "wontfix"))
          priorities.push({ sev: o.sev as Sev, title: title.trim(), ...(why ? { why: why.trim() } : {}), fix: fix.trim(), ...(o.command ? { command: o.command as string } : {}), ...(block ? { block } : {}), status });
      });
    }
  }
  if (errors.length) return { ok: false, errors };
  const counts: Record<Sev, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const p of priorities) counts[p.sev]++;
  return { ok: true, value: { scores, ...(Object.keys(naReasons).length ? { naReasons } : {}), priorities, body: body ?? "", method: method as CritiqueMethod, ...(degradedReason ? { degradedReason } : {}), total, max: scored * 4, counts } };
}

export const openCounts = (c: Pick<Critique, "priorities">): { P0: number; P1: number } => ({
  P0: c.priorities.filter((p) => p.sev === "P0" && p.status === "open").length,
  P1: c.priorities.filter((p) => p.sev === "P1" && p.status === "open").length,
});

export interface TrendPoint { score: number; max: number; at: string }
export interface Trend { line: string; points: TrendPoint[]; comparable: boolean }

/** The last `n` critiques, oldest first, as a one-line trend. Totals out of different
 *  maxima are not like-for-like, so the line shows each denominator and says so. */
export function trend(critiques: readonly Pick<Critique, "total" | "max" | "createdAt">[], n = 5): Trend {
  const pts = [...critiques].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-n).map((c) => ({ score: c.total, max: c.max, at: c.createdAt }));
  if (!pts.length) return { line: "No critiques yet.", points: [], comparable: true };
  if (pts.length === 1) return { line: "First critique for this Kage, no trend yet.", points: pts, comparable: true };
  const comparable = pts.every((p) => p.max === pts[0].max);
  const line = comparable ? `${pts.map((p) => p.score).join(" → ")} (out of ${pts[0].max})` : `${pts.map((p) => `${p.score}/${p.max}`).join(" → ")} (scored different heuristic sets, not like-for-like)`;
  return { line, points: pts, comparable };
}

// --- Markdown export, for review in git ----------------------------------------
const q = (s: string) => JSON.stringify(s);

export function critiqueToMd(c: Critique): string {
  const head = ["---", `critique: ${c.id}`, `kage: ${c.kage}`, `version: ${c.version}`, `fingerprint: ${c.fingerprint}`, `createdAt: ${c.createdAt}`, `author: ${q(c.author)}`, `method: ${c.method}`, ...(c.degradedReason ? [`degradedReason: ${q(c.degradedReason)}`] : []), `score: ${c.total}`, `max: ${c.max}`, `state: ${c.state}`, "---", ""];
  const rows = ["| # | Score |", "| --- | --- |", ...HEURISTIC_KEYS.filter((k) => k in c.scores).map((k) => `| ${k} | ${c.scores[k] === null ? `n/a (${c.naReasons?.[k] ?? ""})` : c.scores[k]} |`), ""];
  const prio = c.priorities.length ? ["## Priorities", "", ...c.priorities.map((p) => `- [${p.status}] ${p.sev}: ${p.title}${p.block ? ` (${p.block})` : ""} — ${p.fix}${p.command ? ` (kages improve ${p.command})` : ""}`), ""] : [];
  return [...head, `# Critique of ${c.kage} v${c.version}`, "", `${c.total}/${c.max}`, "", ...rows, ...prio, "## Report", "", c.body, ""].join("\n");
}
