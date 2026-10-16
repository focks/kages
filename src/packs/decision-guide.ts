// The Technical Decision Pack's generator: an intake (the reader, their decision, the facts and the
// numbers) in, a valid interactive guide out: explanation with sources, a question-driven
// recommendation, a calculator with editable assumptions, setup steps with a checklist, and the sources.
// The point is repeatability: the structure, wiring and honesty labels are fixed here, so a new subject
// is a new intake and not a new hand-built page. Pure; the CLI and the operation wrap it.
//
// Honesty is part of the contract, not decoration: an unsourced guide is refused, every assumption is
// labelled illustrative until the author says otherwise, and a guide the author has not verified says so
// on its face. Sources and the unsourced check help a reviewer; they do not make a claim true.
import type { KageDoc } from "../engine/types.ts";

export interface Option { value: string; label: string }
export interface Question { id: string; label: string; options: Option[] }
export interface Recommendation { when: Record<string, string>; tone?: "success" | "info" | "warning" | "danger"; title: string; text: string }
export interface Assumption { id: string; label: string; value: number; min: number; max: number; step?: number }
export interface Output { label: string; /** Assumption ids multiplied together. */ product: string[]; multiplier?: number; format?: "currency" | "number" | "percent"; caption?: string }
export interface Step { id: string; label: string; description?: string; caption?: string; language?: string; code: string }
export interface Source { label: string; href: string }
export interface Intake {
  id?: string; title: string; subject: string; reader: string; summary: string;
  explain: string;
  diagram?: { label: string; nodes: { id: string; label: string }[]; edges: { from: string; to: string; label?: string }[] };
  questions: Question[]; recommendations: Recommendation[];
  assumptions: Assumption[]; outputs: Output[];
  /** Plot the first output against one assumption, at these values. */
  curve?: { vary: string; at: number[]; output?: number; xLabel: string; yLabel: string };
  assumptionsNote?: string;
  steps: Step[]; checklist: string[];
  faq?: { title: string; body: string }[];
  sources: Source[]; asOf: string;
  /** Who checked the facts, and when. Without it the guide says it is unverified. */
  verified?: { by: string; on: string };
}
export interface GuideResult { doc: KageDoc | null; problems: string[] }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
const isHttps = (u: string) => /^https:\/\/[^\s]+$/.test(u);

export function checkIntake(i: Intake): string[] {
  const p: string[] = [];
  const need = (ok: boolean, msg: string) => { if (!ok) p.push(msg); };
  for (const k of ["title", "subject", "reader", "summary", "explain", "asOf"] as const) need(typeof i[k] === "string" && !!i[k].trim(), `${k} is required`);
  need(i.sources?.length > 0, "at least one source is required: a guide with no sources is a set of unchecked claims");
  for (const s of i.sources ?? []) need(isHttps(s.href) && !!s.label?.trim(), `source "${s.label}" needs a label and an https:// link`);
  need(i.questions?.length >= 1 && i.questions.length <= 3, "give one to three questions");
  const qids = new Set<string>();
  for (const q of i.questions ?? []) {
    need(/^[a-z][a-zA-Z0-9]*$/.test(q.id) && !qids.has(q.id), `question id "${q.id}" must be a unique camelCase word`); qids.add(q.id);
    need(q.options?.length >= 2 && q.options.length <= 5, `question "${q.id}" needs two to five options`);
    need(new Set((q.options ?? []).map((o) => o.value)).size === (q.options ?? []).length && (q.options ?? []).every((o) => o.value && o.label), `question "${q.id}" has an empty or duplicate option`);
  }
  for (const r of i.recommendations ?? []) {
    need(Object.keys(r.when ?? {}).length > 0, `recommendation "${r.title}" must say when it applies`);
    for (const [q, v] of Object.entries(r.when ?? {})) need(!!i.questions?.find((x) => x.id === q)?.options.some((o) => o.value === v), `recommendation "${r.title}" refers to ${q}=${v}, which is not an answer`);
  }
  // Every combination of answers must reach a recommendation; a reader who answers everything and sees nothing was failed by the guide.
  const combos = (i.questions ?? []).reduce<Record<string, string>[]>((acc, q) => acc.flatMap((a) => q.options.map((o) => ({ ...a, [q.id]: o.value }))), [{}]);
  for (const c of combos) if (!(i.recommendations ?? []).some((r) => Object.entries(r.when).every(([k, v]) => c[k] === v))) p.push(`no recommendation covers ${Object.entries(c).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  const ids = new Set<string>();
  for (const a of i.assumptions ?? []) {
    need(/^[a-z][a-zA-Z0-9]*$/.test(a.id) && !ids.has(a.id) && !qids.has(a.id), `assumption id "${a.id}" must be a unique camelCase word`); ids.add(a.id);
    need(a.min <= a.value && a.value <= a.max && a.min < a.max, `assumption "${a.id}": value ${a.value} must lie within ${a.min}..${a.max}`);
  }
  need(i.assumptions?.length >= 1 && i.assumptions.length <= 6, "give one to six assumptions");
  need(i.outputs?.length >= 1 && i.outputs.length <= 4, "give one to four outputs");
  for (const o of i.outputs ?? []) for (const a of o.product) need(ids.has(a), `output "${o.label}" multiplies "${a}", which is not an assumption`);
  if (i.curve) { need(ids.has(i.curve.vary), `curve varies "${i.curve.vary}", which is not an assumption`); need(i.curve.at.length >= 3, "a curve needs at least three points"); need((i.curve.output ?? 0) < (i.outputs?.length ?? 0), "curve.output is out of range"); }
  const sids = new Set<string>();
  for (const s of i.steps ?? []) { need(/^[a-z][a-z0-9-]*$/.test(s.id) && !sids.has(s.id), `step id "${s.id}" must be unique lowercase`); sids.add(s.id); need(!!s.code?.trim() && !!s.label?.trim(), `step "${s.id}" needs a label and code`); }
  need(i.steps?.length >= 2 && i.steps.length <= 8, "give two to eight setup steps");
  need(i.checklist?.length >= 2, "give at least two checklist items");
  if (i.diagram) { const n = new Set(i.diagram.nodes.map((x) => x.id)); for (const e of i.diagram.edges) need(n.has(e.from) && n.has(e.to), `diagram edge ${e.from}→${e.to} refers to a missing node`); }
  return p;
}

export function buildDecisionGuide(i: Intake): GuideResult {
  const problems = checkIntake(i);
  if (problems.length) return { doc: null, problems };
  // Blocks are assembled as plain JSON and validated by the engine afterwards, so the loose type is deliberate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const B: Record<string, any> = {};
  const S = (k: string) => ({ $state: k });
  const eq = (k: string, v: unknown) => ({ $eq: [S(k), v] });
  const setOnChange = (path: string, field = "value") => [{ do: "set", path, value: { $event: field } }];
  const toc: [string, string][] = [];
  const chapter = (id: string, title: string, description: string, children: string[]) => {
    B["a-" + id] = { type: "anchor", props: { name: id } }; B[id] = { type: "section", props: { title, description, level: 2, inset: 0 }, slots: { children } }; toc.push([id, title]); return ["a-" + id, id];
  };

  // 1. Explain
  B["explain-text"] = { type: "markdown", props: { text: i.explain } };
  const explainKids = ["explain-text"];
  if (i.diagram) { B.diagram = { type: "diagram", props: i.diagram }; explainKids.unshift("diagram"); }
  const explain = chapter("explain", "How it works", "What you are choosing between, and why it matters.", explainKids);

  // 2. Decide
  const qkids: string[] = [];
  for (const q of i.questions) { B["q-" + q.id] = { type: "choice", props: { label: q.label, name: q.id, options: q.options }, bind: { value: S(q.id) }, on: { change: setOnChange(q.id) } }; qkids.push("q-" + q.id); }
  const cond = (r: Recommendation) => ({ $and: Object.entries(r.when).map(([k, v]) => eq(k, v)) });
  B.pending = { type: "alert", props: { tone: "info", title: "Answer to see a recommendation", text: `${i.questions.length === 1 ? "One question" : `${i.questions.length} questions`} decide${i.questions.length === 1 ? "s" : ""} it.` }, visible: { $not: { $or: i.recommendations.map(cond) } } };
  i.recommendations.forEach((r, n) => { B["rec-" + n] = { type: "alert", props: { tone: r.tone ?? "success", title: r.title, text: r.text }, visible: cond(r) }; });
  const decide = chapter("decide", "Which fits you?", "Answer, and the recommendation appears.", [...qkids, "pending", ...i.recommendations.map((_, n) => "rec-" + n)]);

  // 3. Calculator
  for (const a of i.assumptions) B["in-" + a.id] = { type: "slider", props: { label: a.label, min: a.min, max: a.max, step: a.step ?? 1 }, bind: { value: S(a.id) }, on: { change: setOnChange(a.id) } };
  const prod = (o: Output) => ({ $round: [{ $mul: [...o.product.map(S), ...(o.multiplier ? [o.multiplier] : [])] }, 2] });
  i.outputs.forEach((o, n) => { B["out-" + n] = { type: "stat", props: { label: o.label, format: o.format ?? "number", ...(o.caption ? { caption: o.caption } : {}) }, bind: { value: prod(o) } }; });
  B.inputs = { type: "section", props: { title: "Try your own numbers", level: 3, tone: "surface" }, slots: { children: i.assumptions.map((a) => "in-" + a.id) } };
  B.outputs = { type: "grid", props: { columns: Math.min(2, i.outputs.length), minSize: "small", gap: 4 }, slots: { children: i.outputs.map((_, n) => "out-" + n) } };
  const belowCalc: string[] = [];
  if (i.curve) {
    const o = i.outputs[i.curve.output ?? 0];
    const swapped = { $round: [{ $mul: [...o.product.map((a) => (a === i.curve!.vary ? { $item: "" } : S(a))), ...(o.multiplier ? [o.multiplier] : [])] }, 2] };
    B.curve = { type: "line-chart", props: { label: `${o.label} as ${i.assumptions.find((a) => a.id === i.curve!.vary)!.label.toLowerCase()} changes`, xLabel: i.curve.xLabel, yLabel: i.curve.yLabel }, bind: { items: { $map: { list: { $data: "curveAt" }, to: { x: { $item: "" }, y: swapped } } } } };
    belowCalc.push("curve");
  }
  B["calc-split"] = { type: "split", props: { ratio: "equal", gap: 6 }, slots: { start: ["inputs"], end: ["outputs"] } };
  B.assumed = { type: "alert", props: { tone: "warning", title: "Illustrative figures", text: i.assumptionsNote ?? "The starting values are placeholders, not quotes or measurements. Replace them with your own numbers before you rely on a result." } };
  const calc = chapter("calc", "Try the numbers", "Change an assumption and every result updates.", ["calc-split", ...belowCalc, "assumed"]);

  // 4. Setup
  B.step = { type: "stepper", props: { label: "Setup steps", interactive: true, steps: i.steps.map((s) => ({ id: s.id, label: s.label, ...(s.description ? { description: s.description } : {}) })) }, bind: { value: S("step") }, on: { change: setOnChange("step") } };
  for (const s of i.steps) B["code-" + s.id] = { type: "code", props: { language: s.language ?? "text", caption: s.caption ?? s.label, wrap: true, code: s.code }, visible: eq("step", s.id) };
  const setup = chapter("setup", "Set it up", "Pick a step to see what to run. Names in angle brackets are placeholders.", ["step", ...i.steps.map((s) => "code-" + s.id)]);

  // 5. Checklist
  const keys = i.checklist.map((_, n) => "check" + (n + 1));
  i.checklist.forEach((label, n) => { B[keys[n]] = { type: "checkbox", props: { label }, bind: { checked: S(keys[n]) }, on: { change: setOnChange(keys[n], "checked") } }; });
  B.ready = { type: "gauge", props: { label: "Ready to hand over", unit: "%", min: 0, max: 100 }, bind: { value: { $mul: [{ $div: [{ $add: keys.map((k) => ({ $if: [S(k), 1, 0] })) }, keys.length] }, 100] } } };
  B.checks = { type: "stack", props: { direction: "column", gap: 2 }, slots: { children: keys } };
  B.checksplit = { type: "split", props: { ratio: "wide-start", gap: 6 }, slots: { start: ["checks"], end: ["ready"] } };
  const list = chapter("checklist", "Before you hand it over", "Tick what is true today.", ["checksplit"]);

  // 6. FAQ and sources
  const tail: string[] = [];
  if (i.faq?.length) { B["faq-list"] = { type: "accordion", props: { items: i.faq.map((f, n) => ({ id: "f" + (n + 1), title: f.title, body: f.body })) }, bind: { value: S("faq") }, on: { change: setOnChange("faq") } }; tail.push(...chapter("faq", "Questions people ask", "", ["faq-list"])); }
  i.sources.forEach((s, n) => { B["src-" + n] = { type: "link", props: { label: s.label, href: s.href, newTab: true } }; });
  B.srcrow = { type: "stack", props: { direction: "row", gap: 4, wrap: true }, slots: { children: i.sources.map((_, n) => "src-" + n) } };
  B.verify = i.verified
    ? { type: "text", props: { variant: "caption", text: `Facts checked by ${i.verified.by} on ${i.verified.on}. Based on the linked sources as of ${i.asOf}; they change, so check them before relying on this.` } }
    : { type: "alert", props: { tone: "warning", title: "Not yet verified", text: `The author has not confirmed the facts in this guide. Based on the linked sources as of ${i.asOf}; check them before relying on it.` } };
  const sources = chapter("sources", "Sources", "Where each claim comes from.", ["srcrow", "verify"]);

  B.hero = { type: "section", props: { eyebrow: i.subject, title: i.title, description: `${i.summary} For ${i.reader}.`, tone: "accent", inset: 6 } };
  B.toc = { type: "toc", props: { title: "On this page", sticky: true, items: toc.map(([target, label]) => ({ label, target, level: 1 })) } };
  B.layout = { type: "split", props: { ratio: "wide-end", gap: 8 }, slots: { start: ["toc"], end: [...explain, ...decide, ...calc, ...setup, ...list, ...tail, ...sources] } };
  B.root = { type: "page", props: { width: "wide", gap: 8 }, slots: { children: ["hero", "layout"] } };

  const state: Record<string, unknown> = { step: i.steps[0].id, faq: "" };
  for (const q of i.questions) state[q.id] = "";
  for (const a of i.assumptions) state[a.id] = a.value;
  for (const k of keys) state[k] = false;
  const doc = { kages: "1.0", id: i.id ?? slug(i.title), title: i.title, system: "atelier@1", root: "root", blocks: B, state, ...(i.curve ? { data: { curveAt: i.curve.at } } : {}), brief: { mode: "read" } } as unknown as KageDoc;
  return { doc, problems: [] };
}
