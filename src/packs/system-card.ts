// One generated, machine-readable document per design system: palette with
// computed contrast, type ramp, spacing, shape, elevation, components, named rules
// and an honest list of known issues. Pure: tokens in, Markdown out. Tokens are
// normative (frontmatter); the prose is generated from the same data so it cannot
// drift, with only the signature move and rules hand-authored (#9).
import tokens from "../../public/ds/tokens.json" with { type: "json" };
import pairsFile from "../design-system/contrast-pairs.json" with { type: "json" };
import { contrast, round2 } from "../design-system/contrast.ts";
import { systems, contracts } from "../engine/data.ts";
import { rulesFor } from "./system-rules.ts";
import { createHash } from "node:crypto";

export type Tok = { name: string; value: string | Record<string, string>; usage?: string };
const T = tokens as unknown as {
  color: { themes: { id: string }[]; tokens: Tok[] };
  type: { families: Record<string, string>; groups: { name: string; family: string; styles: { name: string; family: string; fontSize: string; lineHeight: string; fontWeight: number; letterSpacing?: string; usage?: string }[] }[] };
  spacing: { tokens: Tok[] }; radius: { tokens: Tok[] }; shadow: { tokens: Tok[] }; zIndex: { tokens: Tok[] };
  motion?: { duration?: { tokens: Tok[] }; ease?: { tokens: Tok[] } };
};

export interface Pair { text: string; on: string; min: number; role: string }
export interface PairResult { theme: string; text: string; on: string; role: string; min: number; ratio: number; pass: boolean; waived?: string }
export interface CardIssue { kind: "contrast" | "no-usage" | "unreadable-token"; message: string }
export interface SystemCard { markdown: string; data: Record<string, unknown>; issues: CardIssue[]; pairs: PairResult[] }

const PREFIX = (id: string) => (id === "core" ? "" : id + "-");
const OTHERS = Object.keys(systems);
const belongs = (name: string, id: string) => (id === "core" ? !OTHERS.some((o) => o !== "core" && name.startsWith(o + "-")) : name.startsWith(id + "-"));
const role = (name: string, id: string) => (id === "core" ? name : name.slice(id.length + 1));
const themes = () => T.color.themes.map((t) => t.id);
const str = (v: Tok["value"], th: string) => (typeof v === "string" ? v : v[th] ?? v[themes()[0]]);
// `#` starts a YAML comment after whitespace, so every hex colour must be quoted.
const q = (s: string) => (/^[\w.%-]+$/.test(s) ? s : JSON.stringify(s));
const usage = (u?: string) => (u ?? "").replace(/^(Core|Ledger|Atelier): /, "");

/** Every declared pair resolved for a system and theme, with its ratio. */
export function contrastResults(id: string, colorTokens: Tok[] = T.color.tokens): PairResult[] {
  const out: PairResult[] = [];
  const get = (r: string, th: string) => { const t = colorTokens.find((x) => x.name === PREFIX(id) + r); return t ? str(t.value, th) : undefined; };
  const waivers = (pairsFile.waivers ?? []) as { system?: string; text: string; on: string; theme?: string; reason: string }[];
  for (const th of themes()) for (const p of pairsFile.pairs as Pair[]) {
    const a = get(p.text, th), b = get(p.on, th);
    const ratio = a && b ? contrast(a, b) : NaN;
    const w = waivers.find((x) => x.text === p.text && x.on === p.on && (!x.system || x.system === id) && (!x.theme || x.theme === th));
    out.push({ theme: th, text: p.text, on: p.on, role: p.role, min: p.min, ratio: round2(ratio), pass: ratio >= p.min, ...(w ? { waived: w.reason } : {}) });
  }
  return out;
}

/** `colorTokens` exists so tests can feed a deliberately bad palette and see it reported. */
export function systemCard(id: string, colorTokens: Tok[] = T.color.tokens): SystemCard {
  const sys = systems[id];
  if (!sys) throw new Error(`no system '${id}'`);
  const rules = rulesFor(id);
  const issues: CardIssue[] = [];
  const pairs = contrastResults(id, colorTokens);
  const colors = colorTokens.filter((t) => belongs(t.name, id));
  const ths = themes();

  for (const p of pairs) if (!p.pass && !p.waived) issues.push({ kind: "contrast", message: `${p.theme}: ${p.text} on ${p.on} is ${Number.isNaN(p.ratio) ? "unreadable (not a hex colour or missing)" : p.ratio + ":1"}, needs ${p.min}:1 (${p.role})` });
  for (const t of colors) if (!t.usage?.trim()) issues.push({ kind: "no-usage", message: `colour token ${t.name} has no usage text` });

  const overrides = Object.entries(sys.components).filter(([, ref]) => id === "core" || !(ref as string).startsWith("core/"));
  const inherited = Object.entries(sys.components).filter(([, ref]) => id !== "core" && (ref as string).startsWith("core/")).map(([r]) => r);
  const spacing = T.spacing.tokens.filter((t) => belongs(t.name, id));
  const radius = T.radius.tokens.filter((t) => belongs(t.name, id));
  const shadow = T.shadow.tokens.filter((t) => belongs(t.name, id));
  const typeGroup = T.type.groups.find((g) => g.name.toLowerCase() === id);

  const fm: string[] = ["---", `system: ${id}`, `version: ${sys.version}`, ...(sys.extends ? [`extends: ${sys.extends}`] : []), "tokens:", "  colors:"];
  for (const t of colors) fm.push(`    ${role(t.name, id)}: { ${ths.map((th) => `${th}: ${q(str(t.value, th))}`).join(", ")} }`);
  if (typeGroup) { fm.push("  type:"); for (const s of typeGroup.styles) fm.push(`    ${role(s.name, id)}: { family: ${s.family ?? typeGroup.family}, size: ${s.fontSize}, line: ${s.lineHeight}, weight: ${s.fontWeight}${s.letterSpacing ? `, tracking: ${s.letterSpacing}` : ""} }`); }
  if (spacing.length) { fm.push("  spacing:"); for (const t of spacing) fm.push(`    ${t.name.replace(/^.*?space-/, "")}: ${q(str(t.value, ths[0]))}`); }
  if (radius.length) { fm.push("  radius:"); for (const t of radius) fm.push(`    ${t.name.replace(/^.*?radius-/, "")}: ${q(str(t.value, ths[0]))}`); }
  if (shadow.length) { fm.push("  shadow:"); for (const t of shadow) fm.push(`    ${role(t.name, id).replace(/^shadow-/, "")}: { ${ths.map((th) => `${th}: ${q(str(t.value, th))}`).join(", ")} }`); }
  const motion = [...(T.motion?.duration?.tokens ?? []), ...(T.motion?.ease?.tokens ?? [])];
  if (motion.length) { fm.push("  motion:"); for (const t of motion) fm.push(`    ${t.name.replace(/^motion-/, "")}: ${q(str(t.value, ths[0]))}`); }
  // Core has ~70 roles and lists them once, in the Components section; only overrides are worth repeating.
  if (id !== "core") { fm.push("components:"); for (const [r, ref] of overrides) fm.push(`  ${r}: ${ref}`); }
  fm.push("---");

  const md: string[] = [...fm, "", `# ${sys.name}`, "", "## Overview", "", sys.summary];
  if (rules) md.push("", `**Signature move.** ${rules.signatureMove}`);
  if (id !== "core") md.push("", `Extends ${sys.extends}; roles not listed under Components are inherited.`);

  md.push("", "## Colour", "", `| Role | ${ths.join(" | ")} | Use |`, `| --- | ${ths.map(() => "---").join(" | ")} | --- |`);
  for (const t of colors) md.push(`| \`${role(t.name, id)}\` | ${ths.map((th) => `\`${str(t.value, th)}\``).join(" | ")} | ${usage(t.usage)} |`);
  md.push("", "Declared contrast pairs (WCAG 2.x):", "", `| Text | On | Purpose | Need | ${ths.map((th) => th).join(" | ")} |`, `| --- | --- | --- | --- | ${ths.map(() => "---").join(" | ")} |`);
  const byPair = new Map<string, PairResult[]>();
  for (const p of pairs) { const k = p.text + "|" + p.on; byPair.set(k, [...(byPair.get(k) ?? []), p]); }
  for (const rs of byPair.values()) md.push(`| \`${rs[0].text}\` | \`${rs[0].on}\` | ${rs[0].role} | ${rs[0].min}:1 | ${ths.map((th) => { const r = rs.find((x) => x.theme === th)!; return `${Number.isNaN(r.ratio) ? "n/a" : r.ratio.toFixed(2)}:1 ${r.pass ? "pass" : r.waived ? "waived" : "FAIL"}`; }).join(" | ")} |`);

  md.push("", "## Typography", "");
  if (typeGroup) {
    md.push("| Style | Size / line | Weight | Face | Use |", "| --- | --- | --- | --- | --- |");
    for (const s of typeGroup.styles) md.push(`| \`${role(s.name, id)}\` | ${s.fontSize} / ${s.lineHeight} | ${s.fontWeight} | ${s.family ?? typeGroup.family} | ${usage(s.usage)} |`);
  } else md.push("No styles declared.");

  md.push("", "## Layout and spacing", "");
  if (spacing.length) { md.push("| Step | Value | Use |", "| --- | --- | --- |"); for (const t of spacing) md.push(`| \`${t.name}\` | ${str(t.value, ths[0])} | ${usage(t.usage)} |`); }
  else md.push("Uses Core's spacing steps (0, 1, 2, 3, 4, 6, 8).");

  md.push("", "## Elevation and shape", "");
  if (radius.length) { md.push("| Radius | Value | Use |", "| --- | --- | --- |"); for (const t of radius) md.push(`| \`${t.name.replace(/^.*?radius-/, "")}\` | ${str(t.value, ths[0])} | ${usage(t.usage)} |`); }
  for (const t of shadow) md.push("", `Shadow \`${role(t.name, id)}\`: ${usage(t.usage)} Light \`${str(t.value, ths[0])}\`.`);
  if (!radius.length && !shadow.length) md.push("Shape and elevation come from Core.");

  if (motion.length) { md.push("", "## Motion", "", "| Token | Value | Use |", "| --- | --- | --- |"); for (const t of motion) md.push(`| \`${t.name}\` | ${str(t.value, ths[0])} | ${usage(t.usage)} |`); }

  md.push("", "## Components", "");
  if (id === "core") md.push(`${overrides.length} roles: ` + overrides.map(([r, ref]) => `${r} → ${ref}`).join(", ") + ".");
  else { md.push("Structural overrides:", ""); for (const [r, ref] of overrides) md.push(`- \`${r}\` → \`${ref}\``); md.push("", `Inherited from Core (${inherited.length}): ${inherited.join(", ")}.`); }

  if (rules) { md.push("", "## Named rules", ""); for (const r of rules.rules) md.push(`- **${r.name}** — ${r.statement} ${r.why}${r.lint?.length ? ` (lint: ${r.lint.join(", ")})` : ""}`); }

  const dont: string[] = [];
  for (const r of rules?.rules ?? []) for (const ref of r.source ?? []) { const a = (contracts[ref] as { agent?: { avoid?: string } } | undefined)?.agent?.avoid; if (a) dont.push(`${a.replace(/\.$/, "")} (${ref.split("@")[0]})`); }
  if (dont.length) { md.push("", "## Do and don't", "", "Do: follow the named rules above.", "", "Don't:"); for (const d of [...new Set(dont)]) md.push(`- ${d}`); }

  md.push("", "## Known issues", "");
  if (issues.length) for (const i of issues) md.push(`- ${i.message}`); else md.push("None: contrast pairs pass; colour tokens document usage.");
  const waived = pairs.filter((p) => p.waived && !p.pass);
  for (const w of waived) md.push(`- waived: ${w.theme} ${w.text} on ${w.on} (${w.ratio}:1): ${w.waived}`);

  return { markdown: md.join("\n") + "\n", data: { system: id, version: sys.version, colors: colors.map((t) => t.name), pairs }, issues, pairs };
}

/** A short, stable fingerprint of a system's card: changes whenever a token, rule or
 *  component does, so an agent can tell whether what it cached is still current. */
export function cardDigest(id: string): string {
  return "sha256:" + createHash("sha256").update(systemCard(id).markdown).digest("hex").slice(0, 16);
}
