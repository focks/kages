// The init interview: at most three questions a round, only for what the scan
// could not answer, and never about visual style (that belongs to a surface's
// brief, not the workspace's). Answers arrive through an `Io`, so the same logic
// runs on a terminal, from an --answers file and in tests.
import { createInterface } from "node:readline/promises";
import type { WorkspaceBrief } from "../../store/brief.ts";
import type { Hypothesis } from "./scan.ts";

export interface Question { id: string; text: string; /** Shown, and used when the answer is empty. */ suggestion?: string }
export interface Io { ask(q: Question): Promise<string | undefined> }
export const MAX_QUESTIONS_PER_ROUND = 3;
export const MAX_ANSWER = 2000;

/** Answers from a file: strings or, for list fields, arrays. Missing = unanswered. */
export class ScriptedIo implements Io {
  asked: Question[] = [];
  private answers: Record<string, string | string[] | undefined>;
  constructor(answers: Record<string, string | string[] | undefined>) { this.answers = answers; }
  async ask(q: Question) {
    this.asked.push(q);
    const a = this.answers[q.id];
    return Array.isArray(a) ? a.join("; ") : a;
  }
}

export function ttyIo(input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stderr): Io & { close(): void } {
  const rl = createInterface({ input, output });
  return {
    async ask(q) {
      const hint = q.suggestion ? ` [${q.suggestion}]` : "";
      return rl.question(`${q.text}${hint}\n> `);
    },
    close: () => rl.close(),
  };
}

const LIST = new Set(["absent", "constraints"]);
const splitList = (s: string) => s.split(/[;\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 20);

export interface Draft {
  /** Fields confirmed before this run; an empty answer to a reopened question keeps them confirmed. */
  wasConfirmed?: Set<string>;
  fields: Partial<WorkspaceBrief>;
  /** Fields a human typed or accepted deliberately. Everything else the draft holds is `inferred`. */
  confirmed: Set<string>;
  rounds: number;
  asked: string[];
}

/** Which questions the draft still needs, in priority order. */
export function pending(draft: Pick<Draft, "fields" | "confirmed">, round: 1 | 2): Question[] {
  const f = draft.fields, done = (k: string) => draft.confirmed.has(k);
  if (round === 1) {
    const qs: Question[] = [];
    if (!done("users")) qs.push({ id: "users", text: "Who uses what you build, and in what situation?", suggestion: f.users });
    if (!done("purpose")) qs.push({ id: "purpose", text: "What is it for, and what does success look like?", suggestion: f.purpose });
    if (!done("absent")) qs.push({ id: "absent", text: "What must never be claimed or invented (testimonials, customers, benchmarks, pricing…)? Separate with ;. Mention any real evidence you do have.", suggestion: f.absent?.join("; ") });
    return qs.slice(0, MAX_QUESTIONS_PER_ROUND);
  }
  const qs: Question[] = [];
  if (!done("voice")) qs.push({ id: "voice", text: "How should it sound? Name tone and any vocabulary to use or avoid.", suggestion: f.voice });
  if (!done("constraints")) qs.push({ id: "constraints", text: "Any durable limits: platform, accessibility, localisation, legal terms? Separate with ;.", suggestion: f.constraints?.join("; ") });
  return qs.slice(0, MAX_QUESTIONS_PER_ROUND);
}

/** Apply one answer. An empty answer accepts the suggestion (kept inferred); a typed one confirms the field. */
function apply(draft: Draft, q: Question, raw: string | undefined): void {
  const text = (raw ?? "").trim().slice(0, MAX_ANSWER);
  draft.asked.push(q.id);
  if (text === "") { if (draft.wasConfirmed?.has(q.id)) draft.confirmed.add(q.id); return; }
  if (LIST.has(q.id)) (draft.fields as Record<string, unknown>)[q.id] = splitList(text);
  else (draft.fields as Record<string, unknown>)[q.id] = text;
  draft.confirmed.add(q.id);
}

/** Round 1 always runs for what is unconfirmed; round 2 only when voice AND constraints are both missing. */
export async function runInterview(hyp: Hypothesis, existing: Partial<WorkspaceBrief> | undefined, io: Io, opts: { reopen?: boolean } = {}): Promise<Draft> {
  const fields: Partial<WorkspaceBrief> = { ...existing };
  const confirmed = new Set<string>();
  const inferredBefore = new Set(existing?.inferred ?? []);
  for (const k of Object.keys(existing ?? {})) if (k !== "schema" && k !== "inferred" && !inferredBefore.has(k)) confirmed.add(k);
  if (!fields.purpose && hyp.purpose) fields.purpose = hyp.purpose.value;
  if (!fields.positioning && hyp.positioning) fields.positioning = hyp.positioning.value;
  // --refresh asks everything again, offering the current value as the default.
  const wasConfirmed = new Set(confirmed);
  if (opts.reopen) for (const k of ["users", "purpose", "absent", "voice", "constraints"]) confirmed.delete(k);
  const draft: Draft = { fields, confirmed, rounds: 0, asked: [], wasConfirmed };

  for (const q of pending(draft, 1)) {
    draft.rounds = Math.max(draft.rounds, 1);
    apply(draft, q, await io.ask(q));
  }
  if ((opts.reopen || (!draft.fields.voice && !draft.fields.constraints)) && !confirmed.has("voice") && !confirmed.has("constraints")) {
    const round2 = pending(draft, 2);
    if (round2.length) { draft.rounds = 2; for (const q of round2) apply(draft, q, await io.ask(q)); }
  }
  return draft;
}
