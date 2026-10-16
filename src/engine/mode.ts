// Best-effort guess at a Kage's mode from its blocks, used ONLY when no brief
// declares one: to label ("operate (inferred)") and to decide which mode-gated
// rules may run. Never persisted, never presented as fact. Pure and weighted so
// a document with conflicting signals reports low confidence instead of guessing
// loudly. Weights are the tunable part; the tests pin every shipped example.
import type { Block, KageDoc, Mode } from "./types.ts";

export interface ModeGuess { mode: Mode; confidence: "low" | "medium"; reasons: string[] }

const INPUTS = new Set(["text-input", "number-input", "text-field", "dropdown", "combobox", "checkbox", "switch", "slider", "textarea", "choice", "multiselect", "date-input", "date-range", "file-upload"]);
const DATA = new Set(["table", "data-grid", "kanban", "calendar", "tree"]);
const VIZ = new Set(["bar-chart", "line-chart", "scatter-chart", "area-chart", "donut-chart", "gauge", "sparkline", "heatmap", "combo-chart", "stacked-bar-chart", "funnel-chart", "treemap", "sankey", "stat", "diagram"]);
const PROSE: Record<string, number> = { markdown: 2, "rich-text": 2, list: 1, code: 1, "code-tabs": 2, math: 1, toc: 3, anchor: 1, accordion: 1, text: 0.5, divider: 0.5, alert: 0.5 };
const MEDIA: Record<string, number> = { gallery: 3, video: 3, audio: 2, carousel: 2, scene: 2, map: 2, image: 1 };

export function inferMode(doc: KageDoc): ModeGuess {
  const blocks: Block[] = Object.values(doc && typeof doc.blocks === "object" && doc.blocks ? doc.blocks : {}).filter((b): b is Block => !!b && typeof b === "object");
  const score: Record<Mode, number> = { read: 0, operate: 0, persuade: 0, experience: 0 };
  const why: Record<Mode, string[]> = { read: [], operate: [], persuade: [], experience: [] };
  const add = (m: Mode, n: number, reason: string) => { score[m] += n; if (!why[m].includes(reason)) why[m].push(reason); };
  // Sections alone say little (every report has one); a stack of them, or an accent
  // hero that a primary button answers, is what makes a page read as persuasion.
  const sections = blocks.filter((b) => b.type === "section");
  const hasHero = sections.some((b) => (b.props as { tone?: unknown } | undefined)?.tone === "accent");
  for (const b of blocks) {
    const t = b.type, p = (b.props ?? {}) as Record<string, unknown>;
    if (INPUTS.has(t)) add("operate", 1, "inputs");
    else if (t === "form") add("operate", 2, "a form");
    else if (DATA.has(t)) add("operate", 2, `${t} of records`);
    else if (VIZ.has(t)) add("operate", 1, "charts and figures");
    else if (t === "shell") add("operate", 3, "an app shell");
    else if (t === "modal" || t === "stepper") add("operate", 1, `a ${t}`);
    else if (t === "timeline") add("operate", 0.5, "a timeline");
    else if (t === "button") add("operate", p.variant === "primary" ? 1 : 0.5, "buttons");
    if (PROSE[t]) add("read", PROSE[t], "long-form prose");
    if (MEDIA[t]) add("experience", MEDIA[t], "media the page leads with");
    if (t === "section") {
      if (sections.length >= 3) add("persuade", 0.7, "several titled sections");
      if (p.tone === "accent") add("persuade", 3, "an accent hero");
      if (typeof p.eyebrow === "string") add("persuade", 0.5, "eyebrow labels");
    }
    if (t === "button" && p.variant === "primary" && hasHero) add("persuade", 1, "a primary call to action");
  }
  const ranked = (Object.entries(score) as [Mode, number][]).sort((a, b) => b[1] - a[1]);
  const [top, topScore] = ranked[0], second = ranked[1][1];
  const confident = topScore >= 3 && topScore >= second * 2;
  return { mode: topScore === 0 ? "read" : top, confidence: confident ? "medium" : "low", reasons: topScore === 0 ? ["no distinguishing blocks"] : why[top] };
}

/** The declared mode if the Kage has a brief, else a guess. */
export function modeOf(doc: KageDoc): { mode: Mode; source: "declared" | "inferred"; confidence?: "low" | "medium"; reasons?: string[] } {
  const declared = doc?.brief?.mode;
  if (declared === "read" || declared === "operate" || declared === "persuade" || declared === "experience") return { mode: declared, source: "declared" };
  const g = inferMode(doc);
  return { mode: g.mode, source: "inferred", confidence: g.confidence, reasons: g.reasons };
}
