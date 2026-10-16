// The pure side of the guided "new guide" path: which starting points to show, how a person's
// three edits (title, reader, summary) become an intake, and the text that connects their own
// agent. Kept free of React and fetch so the rules are tested without a browser.
import { EXAMPLES } from "../../../packs/decision-guide-examples.ts";
import type { Intake } from "../../../packs/decision-guide.ts";

export interface Starter { key: string; title: string; subject: string; reader: string; summary: string; facts: string }

export function starters(): Starter[] {
  return Object.entries(EXAMPLES).map(([key, i]) => ({
    key, title: i.title, subject: i.subject, reader: i.reader, summary: i.summary,
    facts: `${i.questions.length} question${i.questions.length === 1 ? "" : "s"}, ${i.assumptions.length} numbers to change, ${i.steps.length} setup steps, ${i.sources.length} source${i.sources.length === 1 ? "" : "s"}`,
  }));
}

export interface Edits { title: string; reader: string; summary: string }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

/** An id that does not collide with an existing Kage: `base`, then `base-2`, `base-3`... */
export function uniqueId(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing), root = slug(base) || "guide";
  if (!taken.has(root)) return root;
  for (let n = 2; ; n++) if (!taken.has(`${root}-${n}`)) return `${root}-${n}`;
}

/** The chosen example with the person's edits applied. The facts, steps and sources stay the example's: they are a starting point to be checked, so the guide keeps saying it is unverified. */
export function intakeFrom(key: string, edits: Edits, existing: Iterable<string>): Intake {
  const base = EXAMPLES[key];
  if (!base) throw new Error(`no starting point '${key}'`);
  const title = edits.title.trim() || base.title;
  return { ...structuredClone(base), title, reader: edits.reader.trim() || base.reader, summary: edits.summary.trim() || base.summary, id: uniqueId(edits.title.trim() ? title : base.id ?? title, existing), verified: undefined };
}

export function checkEdits(e: Edits): string | null {
  if (e.title.length > 120) return "Keep the title under 120 characters.";
  if (e.summary.length > 400) return "Keep the summary under 400 characters.";
  if (e.reader.length > 160) return "Keep the reader description under 160 characters.";
  return null;
}

/** What to say to an agent you already use. Plain words; the agent has the skill and the tools. */
export function agentPrompt(): string {
  return [
    "Use the kages-decision-guide skill to make an interactive decision guide.",
    "Ask me who it is for, what they must decide, and for my notes or source links before you write anything.",
    "Do not invent prices, limits or versions: make them numbers the reader can change.",
    "Build it with `kages decision-guide`, check it, and show me the link. Leave it marked as not yet verified until I confirm the facts.",
  ].join(" ");
}

export function connectCommands(origin: string): { label: string; command: string }[] {
  return [
    { label: "Claude Code: add the Kages tools", command: `claude mcp add --transport http kages ${origin}/api/mcp` },
    { label: "Any terminal: install the skills and check the setup", command: "kages install && kages doctor" },
  ];
}
