// The critique rubric: ten usability heuristics scored 0 to 4, with the signals a
// Kage actually offers for each, plus cognitive-load checks, personas and the
// severity scale. One source consumed by the critique packet, the protocol text and
// the Library, so they cannot disagree. The heuristics are the classic usability
// ten; the anchors, signals and wording are ours.
import type { Mode } from "../engine/types.ts";

export interface Heuristic {
  id: number;
  name: string;
  /** What the reader of a Kage should be able to count on. */
  question: string;
  /** Concrete things to look for in a Kage (block types, lint rules, props). */
  signals: string[];
  /** What each score means for this heuristic. */
  anchors: Record<0 | 1 | 2 | 3 | 4, string>;
  /** Modes in which this heuristic may reasonably be marked n/a (with a reason). */
  naIn?: Mode[];
}

const A = (a: string, b: string, c: string, d: string, e: string): Heuristic["anchors"] => ({ 0: a, 1: b, 2: c, 3: d, 4: e });

export const HEURISTICS: readonly Heuristic[] = [
  { id: 1, name: "Visibility of system status", question: "Does the reader always know what is happening and what state things are in?",
    signals: ["data-bound blocks have empty, loading and error states", "async actions (fetch) set a pending flag the page shows", "the active tab, step or selection is visibly marked", "every figure says what it measures and when"],
    anchors: A("No feedback anywhere; actions look like they did nothing", "Feedback only on some actions; states are ambiguous", "Main actions respond; secondary states are silent", "Clear feedback with minor gaps (an empty state missing)", "Every state is visible and explained") },
  { id: 2, name: "Match with the real world", question: "Does the page speak the audience's language, in their order of thought?",
    signals: ["labels use the audience's words from the brief, not product jargon", "sections follow the reader's task order", "units, formats and examples are familiar", "terms in `absent` and the voice in the brief are respected"],
    anchors: A("Written in internal jargon the reader cannot decode", "Frequent jargon or an order that follows the system, not the task", "Mostly clear with some insider terms", "Natural language with one or two slips", "Reads as if written by the audience's own colleague") },
  { id: 3, name: "User control and freedom", question: "Can the reader back out, undo and move freely?",
    signals: ["inputs can be cleared and forms reset", "modals have a close and a cancel path", "steps can be revisited (stepper interactive)", "destructive actions are confirmable or reversible"],
    anchors: A("Traps: no way back from a state", "Most actions are one-way with no warning", "Some undo or back paths, gaps remain", "Free movement; one irreversible action lacks a guard", "Everything is reversible or clearly guarded") },
  { id: 4, name: "Consistency and standards", question: "Do like things look and behave alike, and does the page follow its system?",
    signals: ["one primary button per region", "the same role does the same job throughout", "the design system's named rules are followed", "spacing uses token steps, not ad hoc values"],
    anchors: A("Every region invents its own conventions", "Several conflicting patterns", "Mostly consistent with visible exceptions", "Consistent; one or two deviations", "A single coherent language end to end") },
  { id: 5, name: "Error prevention", question: "Is it hard to make a mistake in the first place?",
    signals: ["no dead buttons, unwired forms or unreachable modals (lint: dead-button, form-unwired, modal-unreachable)", "inputs constrain what they accept (min, max, required, type)", "choices come from lists when the options are known", "risky actions ask first"],
    anchors: A("Controls that do nothing; easy to destroy data", "Several traps and unconstrained inputs", "Basic constraints; some paths still error-prone", "Well guarded with minor gaps", "Mistakes are designed out") },
  { id: 6, name: "Recognition over recall", question: "Is what the reader needs visible, instead of remembered?",
    signals: ["options are shown, not hidden in memory", "long pages have an outline (toc with anchors)", "context travels with the action (labels next to inputs)", "values the reader entered earlier are shown again where needed"],
    anchors: A("Reader must memorise to proceed", "Important information is off screen or implied", "Mostly visible with some recall burden", "Visible; minor reliance on memory", "Nothing needs remembering") },
  { id: 7, name: "Flexibility and efficiency", question: "Does it serve both the newcomer and the expert?",
    signals: ["filters, search or sorting on long collections (data-grid filterable, combobox)", "sensible defaults the expert can skip", "keyboard operation of interactive blocks", "bulk or shortcut paths for repeated work"],
    anchors: A("One slow path for everyone", "Experts must repeat manual steps", "Some accelerators", "Good defaults and shortcuts", "Fast for experts without losing newcomers"), naIn: ["persuade", "experience"] },
  { id: 8, name: "Aesthetic and minimalist design", question: "Is everything on the page there for a reason?",
    signals: ["no nested containers (lint: nested-sections)", "block count is proportionate to the page's purpose", "no repeated text or decorative blocks that carry no content", "one idea per section, one focal point per view"],
    anchors: A("Cluttered; the point is lost", "Competing elements and redundant content", "Clear core with extra noise", "Focused; a few removable elements", "Nothing to add, nothing to remove") },
  { id: 9, name: "Help recognising, diagnosing and recovering from errors", question: "When something goes wrong, does the page say what and how to fix it?",
    signals: ["field errors name the problem and the fix (text-field error bound to a rule)", "empty states say what is missing and one way out", "failed loads offer a retry or an explanation", "validation appears next to the field, not only at the end"],
    anchors: A("Errors are silent or cryptic", "Errors say something went wrong, nothing more", "Problems named, recovery unclear", "Problem and recovery named with a gap or two", "Every error says what, why and what to do") },
  { id: 10, name: "Help and documentation", question: "Can the reader get unstuck without leaving?",
    signals: ["first-run and empty states orient a newcomer", "FAQs (accordion) answer the real questions", "links lead to deeper detail", "terms are explained where they first appear"],
    anchors: A("A newcomer is stranded", "Help exists but is hard to find", "Basic guidance on the main path", "Good help; small gaps", "Help is right where the question arises"), naIn: ["experience"] },
];

export const PERSONAS = [
  { id: "power-user", name: "Power user", lens: "Wants speed and density. Looks for keyboard paths, filters, defaults and shortcuts, and is irritated by repetition." },
  { id: "first-timer", name: "First-timer", lens: "Arrives cold. Looks for what this is, what to do first and what the words mean; stalls on jargon and empty states." },
  { id: "keyboard-screen-reader", name: "Keyboard and screen-reader user", lens: "Navigates by headings, landmarks and Tab. Needs labels, a visible focus ring, a sensible order and text for every picture or chart." },
  { id: "phone-skimmer", name: "Skimmer on a phone", lens: "Narrow screen, one thumb, half attention. Needs short sections, a clear primary action and nothing that scrolls sideways." },
] as const;

export const COGNITIVE_LOAD = [
  "No more than about four visible choices at any one decision.",
  "One primary action per region, and it is obvious which.",
  "Related things are grouped; unrelated things are separated by space, not boxes.",
  "Detail is available on demand (accordion, tab, modal) instead of all at once.",
  "The reader never has to hold a value in their head to use the next control.",
  "Reading order matches importance: headline, evidence, action.",
] as const;

export const SEVERITY = {
  P0: "Blocks the task or misleads the reader (a dead primary action, a false claim).",
  P1: "A major usability problem that most readers will hit.",
  P2: "A minor problem or inconsistency; worth fixing in the next pass.",
  P3: "Polish: fine to ship without it.",
} as const;

export const SCORING_NOTE = "Most real interfaces score between 20 and 32 out of 40. A 4 means genuinely excellent, and a page that earns many of them should say why. Mark a heuristic n/a with a one-line reason when it truly does not apply, and the total is scaled to the heuristics that do.";

export const RUBRIC = { version: 1, heuristics: HEURISTICS, personas: PERSONAS, cognitiveLoad: COGNITIVE_LOAD, severity: SEVERITY, scoringNote: SCORING_NOTE } as const;
export type Rubric = typeof RUBRIC;

export function rubricMd(): string {
  const L: string[] = ["## Heuristics (score each 0 to 4, or n/a with a reason)", ""];
  for (const h of HEURISTICS) {
    L.push(`### ${h.id}. ${h.name}`, h.question, "", "Look for:", ...h.signals.map((s) => `- ${s}`), "", ...[0, 1, 2, 3, 4].map((n) => `${n} = ${h.anchors[n as 0]}`), h.naIn ? `\nMay be n/a in: ${h.naIn.join(", ")}.` : "", "");
  }
  L.push("## Cognitive load", ...COGNITIVE_LOAD.map((c) => `- ${c}`), "", "## Personas (name the exact blocks that fail each)", ...PERSONAS.map((p) => `- ${p.name}: ${p.lens}`), "", "## Severity", ...Object.entries(SEVERITY).map(([k, v]) => `- ${k}: ${v}`), "", SCORING_NOTE);
  return L.join("\n");
}
