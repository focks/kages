// Validation for the per-Kage brief (`doc.brief`). Deliberately NOT in the oracle
// validator, whose findings are pinned byte-for-byte: the rule registry reports
// a bad brief as an advisory `brief-invalid` finding instead, and the store
// applies the same check to `set_kage_brief` so a bad brief never gets saved
// through that path. Pure.
import type { KageBrief, Mode } from "./types.ts";

export const MODES: readonly Mode[] = ["read", "operate", "persuade", "experience"];
const TEXT_KEYS = ["audience", "job", "primaryAction", "useScene", "notes"] as const;
const KEYS = new Set<string>(["mode", "evidence", ...TEXT_KEYS]);
const MAX_CHARS = 2000, MAX_EVIDENCE = 50;

export type BriefIssue = string;

export function briefIssues(input: unknown): BriefIssue[] {
  if (input === undefined) return [];
  const out: string[] = [];
  if (input === null || typeof input !== "object" || Array.isArray(input)) return ["brief must be an object"];
  const b = input as Record<string, unknown>;
  for (const k of Object.keys(b)) if (!KEYS.has(k)) out.push(`unknown brief field \`${k}\``);
  if (typeof b.mode !== "string" || !MODES.includes(b.mode as Mode)) out.push(`brief.mode must be one of ${MODES.join(", ")}`);
  for (const k of TEXT_KEYS) {
    const v = b[k];
    if (v === undefined) continue;
    if (typeof v !== "string") out.push(`brief.${k} must be a string`);
    else { if (v.length > MAX_CHARS) out.push(`brief.${k} is limited to ${MAX_CHARS} characters`); if (v.includes("\u0000")) out.push(`brief.${k} may not contain NUL`); }
  }
  if (b.evidence !== undefined) {
    if (!Array.isArray(b.evidence)) out.push("brief.evidence must be a list");
    else {
      if (b.evidence.length > MAX_EVIDENCE) out.push(`brief.evidence is limited to ${MAX_EVIDENCE} entries`);
      b.evidence.forEach((e, i) => {
        if (typeof e === "string") { if (e.length > MAX_CHARS || e.includes("\u0000")) out.push(`brief.evidence[${i}] is too long or contains NUL`); return; }
        const o = e as Record<string, unknown> | null;
        if (!o || typeof o !== "object" || typeof o.source !== "string" || o.source.trim() === "") return void out.push(`brief.evidence[${i}] needs a \`source\``);
        for (const k of Object.keys(o)) if (!["claim", "block", "source"].includes(k)) out.push(`brief.evidence[${i}] has unknown field \`${k}\``);
        for (const k of ["claim", "block", "source"]) if (o[k] !== undefined && (typeof o[k] !== "string" || (o[k] as string).length > MAX_CHARS || (o[k] as string).includes("\u0000"))) out.push(`brief.evidence[${i}].${k} must be a short string`);
      });
    }
  }
  return out;
}

export const isKageBrief = (x: unknown): x is KageBrief => briefIssues(x).length === 0 && x !== undefined;
