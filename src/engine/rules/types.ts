// The lint rule contract. A rule is data (id, severity, tier, modes, summary,
// rationale) plus one pure `check`; the registry in ./index.ts is the only list.
// Everything a rule needs is precomputed once per document in LintContext, so a
// rule never re-walks the document and adding one touches only its own file.
import type { Block, KageDoc, Mode } from "../types.ts";
import type { Deprecation } from "../deprecations.ts";

export type Severity = "P0" | "P1" | "P2" | "P3";
/** immediate = cheap and unambiguous, run on every write; deep = heuristic, run at publish/lint time. */
export type Tier = "immediate" | "deep";
export type { Mode };
export type Category = "structure" | "wiring" | "content" | "copy" | "a11y" | "media" | "system";

export interface Finding { at: string; msg: string; fix?: string; /** Overrides the rule's default severity for this one finding. */ severity?: Severity }

export interface TplRef { at: string; ns: string; path: string }

export interface LintContext {
  doc: KageDoc;
  system: string;
  /** Only well-shaped blocks: documents are untrusted and lint runs on drafts. */
  blocks: KageDoc["blocks"];
  actions: { id: string; event: string; action: Record<string, unknown> }[];
  /** "block:event" pairs that have a handler. */
  handled: Set<string>;
  /** "block.output" strings something reads, anywhere in the document. */
  reads: Set<string>;
  stateKeys: Set<string>;
  /** Every `{{ns.path}}` reference inside a `$tpl`, with where it was found. */
  tplRefs: TplRef[];
  /** Blocks reachable from the root through slots. */
  reach: Set<string>;
  /** Block ids that are read or targeted by a command somewhere. */
  referenced: Set<string>;
  /** undefined when the Kage has not declared (or we cannot infer) a mode. */
  mode?: Mode;
  /** The deprecation registry in force (the shipped one unless a caller injects another). */
  deprecations: readonly Deprecation[];
  /** What the workspace brief says must never be fabricated ("testimonials", "customers"…). */
  absent: readonly string[];
  /** Prop names of a block type that take a fixed set of values (never prose). */
  enumPropsOf(type: string): ReadonlySet<string>;
  /** Declared outputs of a block type in this system. */
  outputsOf(type: string): readonly string[];
}

export interface Rule {
  /** kebab-case and stable forever: it is what waivers and logs refer to. */
  id: string;
  category: Category;
  severity: Severity;
  tier: Tier;
  /** Omitted = every mode. A mode-gated rule is skipped when the mode is unknown. */
  modes?: Mode[];
  summary: string;
  rationale: string;
  check(ctx: LintContext): Finding[];
}

export type { Block };
