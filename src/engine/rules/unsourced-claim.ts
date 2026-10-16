import { findClaims, ILLUSTRATIVE, type ClaimKind } from "./claim-patterns.ts";
import { proseOf } from "./prose.ts";
import type { Block, KageDoc, KageEvidence } from "../types.ts";
import type { Finding, LintContext, Mode, Rule, Severity } from "./types.ts";

/** Which claim kinds each mode cares about. Operate surfaces state facts about
 *  data, not marketing, so only literal stat values are checked there (the other rule). */
const KINDS: Record<Mode, readonly ClaimKind[]> = {
  persuade: ["metric", "reach", "superlative", "testimonial"],
  experience: ["metric", "reach", "superlative", "testimonial"],
  read: ["testimonial"],
  operate: [],
};
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** A claim is covered when the brief records a source for it: an object entry whose
 *  `claim` overlaps the matched text (either contains the other, so "500+ teams"
 *  covers "Trusted by 500+ teams"), or that names the block. Free-form string notes
 *  never cover a claim: a note is not a source. */
export function isCovered(evidence: readonly KageEvidence[] | undefined, text: string, block: string): boolean {
  const t = norm(text);
  return (evidence ?? []).some((e) => {
    if (typeof e !== "object" || !e || typeof e.source !== "string" || e.source.trim() === "") return false;
    const c = e.claim ? norm(e.claim) : "";
    return e.block === block || (c !== "" && (t.includes(c) || c.includes(t)));
  });
}

/** True when any block says the figures are illustrative, which is the honest label. */
export function labelledIllustrative(doc: KageDoc, ctx: LintContext): boolean {
  for (const [id, b] of Object.entries(doc.blocks ?? {})) for (const p of proseOf(id, b as Block, ctx.enumPropsOf((b as Block).type))) if (ILLUSTRATIVE.test(p.text)) return true;
  return false;
}

const KIND_LABEL: Record<ClaimKind, string> = { metric: "performance or benefit figure", reach: "customer or user count", superlative: "superlative", testimonial: "testimonial" };

export const unsourcedClaim: Rule = {
  id: "unsourced-claim", category: "content", severity: "P2", tier: "deep",
  summary: "A figure, reach claim, superlative or testimonial with no source on record.",
  rationale: "Models state invented numbers and quotes with total confidence, and a page that looks authoritative but is not is worse than a plain one. This is a heuristic prompt to source or label the claim, not a truth check.",
  check(ctx): Finding[] {
    const mode = ctx.mode;
    // An unknown mode still checks the strongest signal, a testimonial.
    const kinds = mode ? KINDS[mode] : (["testimonial"] as readonly ClaimKind[]);
    if (!kinds.length) return [];
    const doc = ctx.doc, evidence = doc.brief?.evidence;
    const illustrative = labelledIllustrative(doc, ctx);
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(ctx.blocks)) {
      for (const p of proseOf(id, b, ctx.enumPropsOf(b.type))) {
        for (const c of findClaims(p.text)) {
          if (!kinds.includes(c.kind)) continue;
          if (illustrative && c.kind !== "testimonial") continue;
          if (isCovered(evidence, c.text, id)) continue;
          const forbidden = c.kind === "testimonial" && ctx.absent.some((a) => /testimonial|quote|review/i.test(a));
          const severity: Severity = c.kind === "superlative" ? "P3" : forbidden ? "P1" : "P2";
          out.push({
            at: p.at, severity,
            msg: `\`${id}\` makes a ${KIND_LABEL[c.kind]} ("${c.text.slice(0, 90)}") with no source on record.${forbidden ? " The workspace brief lists testimonials as something that must not be invented." : ""}`,
            fix: `Add {"claim":"${c.text.slice(0, 40).replace(/"/g, "'")}","source":"…"} to brief.evidence, bind it to data, label the page illustrative, or remove it.`,
          });
        }
      }
    }
    return out;
  },
};

export const statLiteralUnsourced: Rule = {
  id: "stat-literal-unsourced", category: "content", severity: "P2", tier: "deep", modes: ["operate", "persuade"],
  summary: "A stat block whose headline number is typed in rather than computed from data.",
  rationale: "A number typed into a stat looks like a measurement but nothing says where it came from. Bind it to data or state, source it in the brief, or label the page illustrative.",
  check(ctx): Finding[] {
    const out: Finding[] = [];
    const illustrative = labelledIllustrative(ctx.doc, ctx);
    for (const [id, b] of Object.entries(ctx.blocks)) {
      if (b.type !== "stat") continue;
      const p = (b.props ?? {}) as Record<string, unknown>;
      if (b.bind && "value" in b.bind) continue;
      const v = p.value;
      const literal = typeof v === "number" || (typeof v === "string" && /\d/.test(v));
      if (!literal || illustrative) continue;
      const label = typeof p.label === "string" ? p.label : id;
      if (isCovered(ctx.doc.brief?.evidence, `${label} ${v}`, id)) continue;
      out.push({ at: `/blocks/${id}/props/value`, msg: `Stat \`${id}\` (${label}) shows the typed-in value ${String(v)}; nothing says where it comes from.`, fix: `Bind value to data ($count/$sum over $data), add {"block":"${id}","source":"…"} to brief.evidence, or label the page illustrative.` });
    }
    return out;
  },
};
