// What a claim looks like. English-first and deliberately conservative: each
// pattern needs a number plus a benefit or reach cue, or a quotation plus an
// attribution, so ordinary prose ("3 steps", "version 1.2", "2026") is left alone.
// This is advisory, not a truth oracle; the table is the thing to tune, and
// claim-patterns.test.ts pins both sides of every row.
export type ClaimKind = "metric" | "reach" | "superlative" | "testimonial";

export interface ClaimMatch { kind: ClaimKind; text: string }

const CUE = "(?:faster|slower|quicker|uptime|reliab\\w*|cut|cuts|reduc\\w*|sav(?:e|es|ed|ing|ings)|increas\\w*|improv\\w*|grow\\w*|boost\\w*|more|less|lower\\w*|higher|fewer|ROI|revenue|conversion\\w*|latency|throughput|accura\\w*|efficien\\w*|growth|gain\\w*|lift\\w*|drop\\w*|decreas\\w*|speed\\w*|cheaper|returns?|profit\\w*|retention|satisf\\w*)";
const NUM = "(?:\\d[\\d,]*(?:\\.\\d+)?)";
// 99.9% | 3x | 3× | $2M | $40k | 200 ms-style are NOT claims by themselves; they need a cue in the same sentence.
const FIGURE = new RegExp(`(?:${NUM}\\s?(?:%|×|x(?![a-z0-9]))|\\$\\s?${NUM}\\s?(?:[kKmMbB]\\b|million|billion|thousand)?)`);
const CUE_RE = new RegExp(`\\b${CUE}\\b`, "i");

const REACH_NOUN = "(?:customers|users|teams|companies|businesses|organi[sz]ations|developers|clients|brands|enterprises|people|creators|marketers|engineers|designers|startups)";
const REACH_PHRASE = new RegExp(`\\b(?:trusted by|used by|loved by|relied on by|chosen by|joined by|join|serving|powering)\\s+(?:over\\s+|more than\\s+)?${NUM}\\+?(?:\\s?(?:million|thousand|[kKmM]\\b))?\\s+${REACH_NOUN}\\b`, "i");
const REACH_BIG = new RegExp(`\\b\\d{3,}(?:,\\d{3})*\\+?\\s+${REACH_NOUN}\\b|\\b\\d+(?:\\.\\d+)?\\s?[kKmM]\\+?\\s+${REACH_NOUN}\\b`, "i");

const SUPERLATIVE = /\bthe (?:fastest|best|only|leading|most (?:powerful|secure|reliable|popular|trusted|advanced)) (?:way|tool|platform|solution|choice|option|product|app|service|provider|company|software|api|database|engine|framework|place)\b|(?<![\w#])#1(?!\d)|\bnumber[- ]one\b|\bbest-in-class\b|\bindustry[- ]leading\b|\bworld[- ]class\b|\bmarket[- ]leading\b|\bunrivall?ed\b|\bunmatched\b|\bsecond to none\b/i;

const QUOTE_ATTRIB = /[“"][^”"]{15,300}[”"]\s*(?:[-–—~]\s*)[A-Z][\p{L}.'’ -]{1,40}(?:,\s*[\p{L}&.'’ -]{2,50})?/u;
const ATTRIB_LINE = /^\s*[-–—]\s*[A-Z][\p{L}.'’ -]{1,40},\s*[\p{L}&.'’ -]{2,50}\s*$/mu;

/** Sentence-ish split so a number in one sentence is not credited to a cue in the next. */
const sentences = (t: string): string[] => t.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);

export function findClaims(text: string): ClaimMatch[] {
  const out: ClaimMatch[] = [];
  const quote = QUOTE_ATTRIB.exec(text);
  if (quote) out.push({ kind: "testimonial", text: quote[0] });
  else if (/^\s*>?\s*[“"]/.test(text) && ATTRIB_LINE.test(text)) out.push({ kind: "testimonial", text: text.trim().slice(0, 120) });
  for (const s of sentences(text)) {
    const reach = REACH_PHRASE.exec(s) ?? REACH_BIG.exec(s);
    if (reach) out.push({ kind: "reach", text: reach[0] });
    const fig = FIGURE.exec(s);
    if (fig && CUE_RE.test(s) && !reach) out.push({ kind: "metric", text: s.trim().slice(0, 120) });
    const sup = SUPERLATIVE.exec(s);
    if (sup) out.push({ kind: "superlative", text: sup[0] });
  }
  return out;
}

/** Doc-level honest labelling: text that says the figures are not real. */
export const ILLUSTRATIVE = /\b(?:illustrative|sample data|example data|placeholder|preview data|dummy data|for demonstration|not real data)\b/i;
