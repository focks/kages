// Hand-authored named rules per design system: short, quotable constraints that
// each cite the contract guidance they distil. They live in
// src/design-system/system-rules.json, NOT in src/engine/data (regenerated from the
// oracle) and NOT in catalog() (golden-pinned): they appear in packs, system cards
// and advice only. A rule with neither a source contract nor a lint link is
// decoration, and the unit test rejects it.
import rules from "../design-system/system-rules.json" with { type: "json" };
import type { Mode } from "../engine/types.ts";

export interface NamedRule {
  id: string;
  name: string;
  statement: string;
  why: string;
  modes?: Mode[];
  /** F2 lint rule ids that mechanically enforce it. */
  lint?: string[];
  /** Contract refs whose `agent.use`/`avoid` text it distils. */
  source?: string[];
}
export interface SystemRules { signatureMove: string; rules: NamedRule[] }

export const SYSTEM_RULES = rules as unknown as Record<string, SystemRules>;

export function rulesFor(systemId: string): SystemRules | undefined { return SYSTEM_RULES[systemId]; }

/** The "Named rules" block packs embed. Ledger and Atelier extend Core, so Core's
 *  rules apply to them too; that is stated, not repeated. */
export function namedRulesMd(systemId: string): string {
  const r = rulesFor(systemId);
  if (!r) return "";
  const lines = [`Signature: ${r.signatureMove}`, ""];
  for (const x of r.rules) lines.push(`- **${x.name}** — ${x.statement} ${x.why}${x.lint?.length ? ` (checked by lint: ${x.lint.join(", ")})` : ""}`);
  if (systemId !== "core") lines.push("", "Core's named rules also apply.");
  return lines.join("\n");
}
