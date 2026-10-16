// The text an agent receives for `kages improve <command> <kage>`: the playbook with the
// context it needs, assembled once. Pure; nothing here runs anything. Everything that
// came from the Kage (descriptions, finding text, backlog titles) is inside an untrusted
// data fence, and the whole packet is capped so it never swamps the agent's context.
import type { Advice } from "../engine/advice.ts";
import type { BacklogItem } from "../components/dashboard/critique/critique-model.ts";
import type { CommandMeta } from "./commands/commands.ts";

export const PACKET_BUDGET = 10_000;
const fence = (s: string) => `<kage-content untrusted="true">\n${s}\n</kage-content>`;

export interface PacketParts {
  meta: CommandMeta;
  playbook: string;
  target?: string;
  /** The text rendering of get_context (already fenced where it holds authored text). */
  contextText?: string;
  description?: string;
  backlog?: BacklogItem[];
  findings?: Advice[];
}

function build(p: PacketParts, descLines: number, findingCount: number, backlogCount: number): string {
  const L: string[] = [`# kages improve ${p.meta.name}${p.target ? " " + p.target : ""}`, "", `${p.meta.description}.`, "", "## Playbook", "", p.playbook];
  if (p.contextText) L.push("", "## Context", "", p.contextText);
  const open = (p.backlog ?? []).filter((b) => b.status === "open").slice(0, backlogCount);
  if (p.backlog) {
    L.push("", "## Open critique backlog", "");
    L.push(open.length ? fence(open.map((b) => `${b.sev} ${b.title}${b.block ? ` (${b.block})` : ""}: ${b.fix}${b.command ? ` [kages improve ${b.command}]` : ""}`).join("\n")) : "None open.");
  }
  if (p.findings) {
    const top = p.findings.slice(0, findingCount);
    L.push("", "## Top findings", "", top.length ? fence(top.map((f) => `${f.severity ?? "-"} ${f.at} ${f.code}: ${f.msg}`).join("\n")) : "None.");
  }
  if (p.description) { const lines = p.description.split("\n"); L.push("", "## Described view", "", fence(lines.slice(0, descLines).join("\n") + (lines.length > descLines ? `\n… (${lines.length - descLines} more lines)` : ""))); }
  return L.join("\n");
}

/** Trim the largest, least essential parts first until the packet fits. */
export function assemblePacket(p: PacketParts, budget = PACKET_BUDGET): { text: string; chars: number; trimmed: boolean } {
  const steps: [number, number, number][] = [[80, 8, 8], [40, 8, 8], [20, 5, 8], [10, 5, 5], [0, 3, 3], [0, 0, 0]];
  let text = "";
  for (const [d, f, b] of steps) { text = build(p, d, f, b); if (text.length <= budget) return { text, chars: text.length, trimmed: d < 80 }; }
  return { text, chars: text.length, trimmed: true };
}
