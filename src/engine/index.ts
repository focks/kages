// @kages/engine — the pure, shared engine: registry, expressions, validator,
// describe and the structured-output compiler. Same surface as window.Kages.

export { systems, contracts, interfaces } from "./data.ts";
export { resolve, semverMatch, systemOf } from "./resolve.ts";
export { evaluate, getPath, setPath, clone, merge, isExpr, walkExpr, operatorOf, OPERATORS } from "./expr.ts";
export { validate } from "./validate.ts";
export { describe } from "./describe.ts";
export { advise, lint, lintDetailed, review, nearest } from "./advice.ts";
export { outlineToKage } from "./outline.ts";
export type { OutlineOptions, OutlineResult } from "./outline.ts";
export type { Advice, LintOptions, LintReport } from "./advice.ts";
export { RULES, ruleById } from "./rules/index.ts";
export type { Rule, Severity, Tier, Mode } from "./rules/types.ts";
export { catalog } from "./catalog.ts";
export { generationSchema, fromGenerated, toGenerated } from "./generate.ts";
export { initLocals, makeCtx, runActions, materialize, ACTIONS } from "./runtime-core.ts";
export type * from "./types.ts";
