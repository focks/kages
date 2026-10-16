// Structural lint for playbooks. Behaviour of an agent following one cannot be unit
// tested, but a playbook that names a command or op that does not exist can: that is the
// failure that silently sends agents nowhere, so it is checked on every `npm test`.
import type { CommandMeta } from "./commands.ts";

export const REQUIRED_HEADINGS = ["Purpose", "Before you start", "Scope", "Steps", "Verification", "Done when", "Hand off to"] as const;
export const MAX_PLAYBOOK_CHARS = 4096;

export interface Known { ops: ReadonlySet<string>; verbs: ReadonlySet<string>; commands: ReadonlySet<string> }

export function lintPlaybook(meta: CommandMeta, text: string | undefined, known: Known): string[] {
  const out: string[] = [], at = (m: string) => out.push(`${meta.name}: ${m}`);
  if (!text) { at("has no playbook text"); return out; }
  const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  if (JSON.stringify(headings) !== JSON.stringify(REQUIRED_HEADINGS)) at(`headings must be exactly ${REQUIRED_HEADINGS.join(" / ")} (found ${headings.join(" / ") || "none"})`);
  if (text.length > MAX_PLAYBOOK_CHARS) at(`is ${text.length} characters; the limit is ${MAX_PLAYBOOK_CHARS}`);
  if (/\b(TODO|FIXME|TBD|lorem ipsum|XXX)\b/i.test(text)) at("contains a placeholder (TODO, FIXME, TBD, lorem)");
  for (const m of text.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)) if (!known.ops.has(m[1])) at(`mentions \`${m[1]}\`, which is not an operation`);
  for (const m of text.matchAll(/`kages ([a-z-]+)/g)) if (!known.verbs.has(m[1])) at(`mentions \`kages ${m[1]}\`, which is not a CLI command`);
  for (const m of text.matchAll(/kages improve ([a-z]+)/g)) if (!known.commands.has(m[1])) at(`mentions improve command ${m[1]}, which does not exist`);
  for (const op of meta.ops) {
    if (!known.ops.has(op)) at(`metadata lists ${op}, which is not an operation`);
    if (!text.includes("`" + op + "`") && op !== "tune_kage" && op !== "get_context") at(`metadata lists ${op} but the playbook never uses it`);
  }
  for (const n of meta.next) if (!known.commands.has(n)) at(`hands off to ${n}, which does not exist`);
  const handoff = text.split("## Hand off to")[1] ?? "";
  for (const n of meta.next) if (!new RegExp(`\\b${n}\\b`).test(handoff)) at(`metadata says next is ${n} but the Hand off section does not mention it`);
  if (!/Look once/.test(text)) at("the Verification section must use the bounded-verification rule");
  return out;
}
