// Metadata for the improvement commands: what each is for, what it needs, where to go
// next. The playbook text is in ./playbooks.ts. Everything user-facing about the
// commands (CLI list, COMMANDS.md, MCP prompts, plugin files) is generated from this.
import { IMPROVE_COMMANDS, type ImproveCommand } from "../../engine/improve.ts";
import { PLAYBOOKS } from "./playbooks.ts";

export type Category = "Evaluate" | "Refine" | "Fix" | "Enhance";
export interface CommandMeta {
  name: ImproveCommand; category: Category; description: string; argumentHint: string;
  /** Operation names the playbook relies on (checked against the op table). */
  ops: string[]; next: ImproveCommand[];
}

export const COMMANDS: readonly CommandMeta[] = [
  { name: "critique", category: "Evaluate", description: "Review a Kage with evidence and a rubric; save a prioritised backlog", argumentHint: "<kage>", ops: ["get_context", "critique_kage", "save_critique"], next: ["polish", "distill", "harden"] },
  { name: "polish", category: "Refine", description: "Clear the open P0/P1 backlog, then make the page consistent", argumentHint: "<kage>", ops: ["get_context", "list_critiques", "lint_kage", "validate_patch", "patch_kage", "set_critique_priority", "close_critique"], next: ["critique", "clarify"] },
  { name: "distill", category: "Refine", description: "Remove what the page does not need: fewer blocks, same job", argumentHint: "<kage>", ops: ["get_context", "describe_kage", "lint_kage", "validate_patch", "patch_kage"], next: ["polish", "quieter"] },
  { name: "harden", category: "Refine", description: "Empty, long and failing data; forms that explain their errors", argumentHint: "<kage>", ops: ["get_context", "describe_kage", "validate_patch", "patch_kage"], next: ["adapt", "onboard"] },
  { name: "clarify", category: "Fix", description: "Buttons say what they do; errors name the problem and the way out", argumentHint: "<kage>", ops: ["get_context", "describe_kage", "validate_patch", "patch_kage"], next: ["polish", "harden"] },
  { name: "onboard", category: "Refine", description: "Orientation, first-run and empty states for a newcomer", argumentHint: "<kage>", ops: ["get_context", "describe_kage", "validate_patch", "patch_kage"], next: ["clarify", "critique"] },
  { name: "adapt", category: "Fix", description: "Phone, tablet, desktop and dark theme", argumentHint: "<kage>", ops: ["get_context", "validate_patch", "patch_kage"], next: ["harden", "polish"] },
  { name: "quieter", category: "Enhance", description: "One controlled step down in intensity", argumentHint: "<kage> [--scope block]", ops: ["get_context", "tune_kage"], next: ["polish", "distill", "bolder"] },
  { name: "bolder", category: "Enhance", description: "One controlled step up in intensity, by mode", argumentHint: "<kage> [--scope block]", ops: ["get_context", "tune_kage"], next: ["polish", "critique"] },
];

export const commandMeta = (name: string): CommandMeta | undefined => COMMANDS.find((c) => c.name === name);
export const playbook = (name: string): string | undefined => PLAYBOOKS[name];
export { IMPROVE_COMMANDS, PLAYBOOKS };

/** The generated index, grouped by category. */
export function commandsMd(): string {
  const cats: Category[] = ["Evaluate", "Refine", "Fix", "Enhance"];
  const out = ["# Kages improve commands", "", "Name a move instead of describing it. `kages improve <command> <kage>` assembles the playbook with the context an agent needs; nothing runs by itself.", ""];
  for (const cat of cats) {
    out.push(`## ${cat}`, "", "| Command | What it does | Next |", "| --- | --- | --- |");
    for (const c of COMMANDS.filter((x) => x.category === cat)) out.push(`| \`${c.name} ${c.argumentHint}\` | ${c.description} | ${c.next.join(", ")} |`);
    out.push("");
  }
  out.push("## Planned", "", "colorize, typeset, layout, animate, delight, overdrive, extract and optimize need capabilities Kages does not have yet (palette editing, font control, motion blocks, performance budgets).", "");
  return out.join("\n");
}

export const promptName = (c: string) => `kages-improve-${c}`;
