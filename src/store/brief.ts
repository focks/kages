// The workspace brief: durable product truth (who it is for, what it is for, what
// must never be invented) captured once so every authoring and review flow loads
// it instead of re-asking. It is untrusted TEXT to every agent that reads it,
// the same rule as Kage content. Pure: validation and merge only; storage and
// permissions live in the store.

import type { Evidence, EvidenceKind, WorkspaceBrief } from "../engine/types.ts";
export type { Evidence, EvidenceKind, WorkspaceBrief };

export interface WorkspaceBriefRecord { id: "brief"; brief: WorkspaceBrief; revision: number; updatedAt: string; updatedBy: string }

export const MAX_FIELD_CHARS = 2000;
export const MAX_ITEMS = 20;
export const MAX_EVIDENCE = 50;
export const MAX_BRIEF_BYTES = 32 * 1024;

export const TEXT_FIELDS = ["users", "purpose", "positioning", "operatingContext", "voice", "brandCommitments"] as const;
export const LIST_FIELDS = ["constraints", "absent", "principles", "openDecisions", "inferred"] as const;
const KINDS: readonly string[] = ["data", "quote", "asset", "link"];
export const BRIEF_FIELDS: readonly string[] = [...TEXT_FIELDS, ...LIST_FIELDS, "evidence"];
const KNOWN = new Set<string>(["schema", ...BRIEF_FIELDS]);

export type BriefCheck = { ok: true; brief: WorkspaceBrief; warnings: string[] } | { ok: false; errors: string[] };

const NUL = "\u0000";
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Soft scan: a brief is shared with every agent in the workspace, so flag text
 *  that looks like contact details or credentials. Warns, never blocks. */
export function sensitiveScan(brief: WorkspaceBrief): string[] {
  const out: string[] = [];
  const texts: [string, string][] = [];
  for (const k of TEXT_FIELDS) if (typeof brief[k] === "string") texts.push([k, brief[k] as string]);
  for (const k of LIST_FIELDS) for (const s of brief[k] ?? []) texts.push([k, s]);
  for (const e of brief.evidence ?? []) texts.push(["evidence", `${e.ref} ${e.note ?? ""}`]);
  for (const [k, t] of texts) {
    if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t)) out.push(`${k} contains something that looks like an email address`);
    if (/\b(sk|pk|ghp|gho|xox[abp])[-_][A-Za-z0-9_-]{16,}/.test(t) || /\b[A-Za-z0-9+/_-]{40,}\b/.test(t)) out.push(`${k} contains something that looks like a secret or token`);
  }
  return [...new Set(out)];
}

/** Validate untrusted input into a normalised brief. Strings are trimmed so a
 *  Markdown round trip is lossless; unknown keys are rejected rather than
 *  silently stored (a typo like `purpse` must not vanish). */
export function validateBrief(input: unknown): BriefCheck {
  const errors: string[] = [];
  if (input === null || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: ["the brief must be an object"] };
  const o = input as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KNOWN.has(k)) errors.push(`unknown field \`${k}\` (fields: ${BRIEF_FIELDS.join(", ")})`);
  if (has(o, "schema") && o.schema !== 1) errors.push("schema must be 1");

  const text = (k: string, required: boolean): string | undefined => {
    const v = o[k];
    if (v === undefined) { if (required) errors.push(`\`${k}\` is required`); return undefined; }
    if (typeof v !== "string") { errors.push(`\`${k}\` must be a string`); return undefined; }
    const t = v.trim();
    if (v.includes(NUL)) errors.push(`\`${k}\` may not contain the NUL character`);
    if (t.length > MAX_FIELD_CHARS) errors.push(`\`${k}\` is limited to ${MAX_FIELD_CHARS} characters`);
    if (required && t === "") errors.push(`\`${k}\` is required`);
    return t === "" && !required ? undefined : t;
  };
  const list = (k: string, max: number): string[] | undefined => {
    const v = o[k];
    if (v === undefined) return undefined;
    if (!Array.isArray(v)) { errors.push(`\`${k}\` must be a list of strings`); return undefined; }
    if (v.length > max) errors.push(`\`${k}\` is limited to ${max} items`);
    const items: string[] = [];
    v.forEach((x, i) => {
      if (typeof x !== "string") return void errors.push(`\`${k}[${i}]\` must be a string`);
      const t = x.trim();
      if (x.includes(NUL)) errors.push(`\`${k}[${i}]\` may not contain the NUL character`);
      if (/[\r\n]/.test(t)) errors.push(`\`${k}[${i}]\` must be a single line`);
      if (t.length > MAX_FIELD_CHARS) errors.push(`\`${k}[${i}]\` is limited to ${MAX_FIELD_CHARS} characters`);
      if (t === "") return void errors.push(`\`${k}[${i}]\` is empty`);
      items.push(t);
    });
    return items.length ? items : undefined;
  };

  const brief: WorkspaceBrief = { schema: 1, users: text("users", true) ?? "", purpose: text("purpose", true) ?? "" };
  for (const k of ["positioning", "operatingContext", "voice", "brandCommitments"] as const) { const t = text(k, false); if (t !== undefined) brief[k] = t; }
  for (const k of LIST_FIELDS) { const l = list(k, MAX_ITEMS); if (l) brief[k] = l; }
  if (brief.inferred) for (const f of brief.inferred) if (!BRIEF_FIELDS.includes(f)) errors.push(`inferred names \`${f}\`, which is not a brief field`);

  if (o.evidence !== undefined) {
    if (!Array.isArray(o.evidence)) errors.push("`evidence` must be a list");
    else {
      if (o.evidence.length > MAX_EVIDENCE) errors.push(`\`evidence\` is limited to ${MAX_EVIDENCE} items`);
      const ev: Evidence[] = [];
      o.evidence.forEach((x, i) => {
        const e = x as Record<string, unknown> | null;
        if (!e || typeof e !== "object") return void errors.push(`evidence[${i}] must be an object`);
        for (const k of Object.keys(e)) if (!["kind", "ref", "note"].includes(k)) errors.push(`evidence[${i}] has unknown field \`${k}\``);
        if (typeof e.kind !== "string" || !KINDS.includes(e.kind)) return void errors.push(`evidence[${i}].kind must be one of ${KINDS.join(", ")}`);
        if (typeof e.ref !== "string" || e.ref.trim() === "") return void errors.push(`evidence[${i}].ref is required`);
        if (e.note !== undefined && typeof e.note !== "string") return void errors.push(`evidence[${i}].note must be a string`);
        const ref = e.ref.trim(), note = typeof e.note === "string" ? e.note.trim() : "";
        for (const [n, v] of [["ref", ref], ["note", note]] as const) {
          if (v.includes(NUL)) errors.push(`evidence[${i}].${n} may not contain the NUL character`);
          if (/[\r\n]/.test(v)) errors.push(`evidence[${i}].${n} must be a single line`);
          if (v.length > MAX_FIELD_CHARS) errors.push(`evidence[${i}].${n} is limited to ${MAX_FIELD_CHARS} characters`);
        }
        ev.push({ kind: e.kind as EvidenceKind, ref, ...(note ? { note } : {}) });
      });
      if (ev.length) brief.evidence = ev;
    }
  }

  if (!errors.length && JSON.stringify(brief).length > MAX_BRIEF_BYTES) errors.push(`the brief is limited to ${MAX_BRIEF_BYTES / 1024} KB in total`);
  return errors.length ? { ok: false, errors } : { ok: true, brief, warnings: sensitiveScan(brief) };
}

/** Shallow merge for `set_brief {merge: true}`: top-level fields replace (arrays
 *  too), and an explicit `null` clears an optional field. */
export function mergeBrief(current: WorkspaceBrief | undefined, patch: unknown): unknown {
  if (!current || patch === null || typeof patch !== "object" || Array.isArray(patch)) return patch;
  const out: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) { if (v === null) delete out[k]; else out[k] = v; }
  return out;
}
