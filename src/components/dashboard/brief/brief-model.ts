// The brief form's brain: which fields exist, how a stored brief becomes form
// text and back, and what changed. Pure (no React, relative imports) so the
// round trip and the limits are unit-tested; the sheet only renders it.
// Limits mirror src/store/brief.ts, which remains the authority on the server.

export type FieldKind = "text" | "list" | "evidence";
export interface FieldMeta { key: string; label: string; kind: FieldKind; required?: boolean; rows: number; help: string }

export const BRIEF_FORM_FIELDS: readonly FieldMeta[] = [
  { key: "users", label: "Who uses it", kind: "text", required: true, rows: 3, help: "Who, in what situation, doing what job." },
  { key: "purpose", label: "What it is for", kind: "text", required: true, rows: 3, help: "What the work is for and what success looks like." },
  { key: "absent", label: "Never invent", kind: "list", rows: 3, help: "One per line: testimonials, customers, benchmarks, pricing…" },
  { key: "positioning", label: "Positioning", kind: "text", rows: 2, help: "What only this product or team can truthfully say." },
  { key: "voice", label: "Voice", kind: "text", rows: 2, help: "Tone, and vocabulary to use or avoid." },
  { key: "constraints", label: "Constraints", kind: "list", rows: 3, help: "One per line: platform, accessibility, localisation, legal terms." },
  { key: "operatingContext", label: "Operating context", kind: "text", rows: 2, help: "Environments, tools and rituals that are facts." },
  { key: "brandCommitments", label: "Brand commitments", kind: "text", rows: 2, help: "Names, assets and identity rules the owner made binding." },
  { key: "principles", label: "Principles", kind: "list", rows: 3, help: "Three to five durable rules, one per line." },
  { key: "openDecisions", label: "Open decisions", kind: "list", rows: 2, help: "Facts that are explicitly undecided." },
  { key: "evidence", label: "Evidence", kind: "evidence", rows: 3, help: "One per line: kind | reference | note. Kinds: data, quote, asset, link." },
];

export type FormState = Record<string, string>;
export const MAX_FIELD_CHARS = 2000;

export function toForm(brief: Record<string, unknown> | null | undefined): FormState {
  const f: FormState = {};
  for (const m of BRIEF_FORM_FIELDS) {
    const v = brief?.[m.key];
    if (m.kind === "text") f[m.key] = typeof v === "string" ? v : "";
    else if (m.kind === "list") f[m.key] = Array.isArray(v) ? v.join("\n") : "";
    else f[m.key] = Array.isArray(v) ? v.map((e: { kind: string; ref: string; note?: string }) => [e.kind, e.ref, e.note].filter((x) => x !== undefined && x !== "").join(" | ")).join("\n") : "";
  }
  return f;
}

/** Form text → the object `set_brief` takes. Blank fields are omitted, so clearing a field removes it. */
export function fromForm(form: FormState, inferred: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = { schema: 1 };
  for (const m of BRIEF_FORM_FIELDS) {
    const raw = (form[m.key] ?? "").trim();
    if (!raw) continue;
    if (m.kind === "text") out[m.key] = raw;
    else if (m.kind === "list") out[m.key] = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    else out[m.key] = raw.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [kind, ref, ...note] = l.split("|").map((p) => p.trim()); return { kind, ref, ...(note.length && note.join(" | ") ? { note: note.join(" | ") } : {}) }; });
  }
  // Fields a person has now edited are theirs; only untouched drafts stay inferred.
  const keep = inferred.filter((k) => k in out);
  if (keep.length) out.inferred = keep;
  return out;
}

/** Keys whose form text differs: drives the dirty state and which inferred flags clear on save. */
export function changedFields(before: FormState, after: FormState): string[] {
  return BRIEF_FORM_FIELDS.map((m) => m.key).filter((k) => (before[k] ?? "").trim() !== (after[k] ?? "").trim());
}

export interface FieldProblem { key: string; message: string }
/** Cheap client-side checks so the person sees a problem before a round trip. */
export function problems(form: FormState): FieldProblem[] {
  const out: FieldProblem[] = [];
  for (const m of BRIEF_FORM_FIELDS) {
    const raw = (form[m.key] ?? "").trim();
    if (m.required && !raw) out.push({ key: m.key, message: `${m.label} is required.` });
    const lines = m.kind === "text" ? [raw] : raw.split("\n").map((s) => s.trim()).filter(Boolean);
    if (lines.some((l) => l.length > MAX_FIELD_CHARS)) out.push({ key: m.key, message: `${m.label}: each entry is limited to ${MAX_FIELD_CHARS} characters.` });
    if (m.kind === "list" && lines.length > 20) out.push({ key: m.key, message: `${m.label}: at most 20 lines.` });
    if (m.kind === "evidence") {
      if (lines.length > 50) out.push({ key: m.key, message: "Evidence: at most 50 lines." });
      lines.forEach((l, i) => { const [kind, ref] = l.split("|").map((p) => p.trim()); if (!["data", "quote", "asset", "link"].includes(kind) || !ref) out.push({ key: m.key, message: `Evidence line ${i + 1}: write "kind | reference | note" with kind data, quote, asset or link.` }); });
    }
  }
  return out;
}

/** Fields (by label) the brief still lacks, for the empty-state prompt. */
export function missingRequired(brief: Record<string, unknown> | null | undefined): string[] {
  return BRIEF_FORM_FIELDS.filter((m) => m.required && !(typeof brief?.[m.key] === "string" && (brief[m.key] as string).trim())).map((m) => m.label);
}
