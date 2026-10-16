// The evidence an agent needs to critique a Kage. Pure: the op gathers plain inputs,
// this shapes them. It never scores anything (Kages calls no model) and it carries
// the rubric and protocol so one call is enough.
import type { Advice } from "../engine/advice.ts";
import type { Block, KageBrief, KageDoc, Mode, WorkspaceBrief } from "../engine/types.ts";
import { RUBRIC, type Rubric } from "./rubric.ts";
import { PROTOCOL, PROTOCOL_VERSION } from "./critique-protocol.ts";

const INTERACTIVE = new Set(["button", "form", "text-input", "number-input", "text-field", "date-input", "date-range", "dropdown", "combobox", "choice", "multiselect", "checkbox", "switch", "slider", "textarea", "file-upload", "tabs", "tab-panel", "accordion", "stepper", "modal", "kanban", "data-grid", "tree", "carousel", "gallery", "calendar", "sidebar"]);

export interface PacketStats { blocks: number; depth: number; types: Record<string, number>; interactive: number; stateKeys: number; compositions: number; dataSets: number }

export function statsOf(doc: KageDoc): PacketStats {
  const blocks = (doc && typeof doc.blocks === "object" && doc.blocks ? doc.blocks : {}) as Record<string, Block>;
  const types: Record<string, number> = {};
  let interactive = 0;
  for (const b of Object.values(blocks)) { if (!b || typeof b !== "object") continue; types[b.type] = (types[b.type] ?? 0) + 1; if (INTERACTIVE.has(b.type)) interactive++; }
  let depth = 0;
  const seen = new Set<string>();
  const walk = (id: string, d: number) => {
    const b = blocks[id];
    if (!b || seen.has(id)) return;
    seen.add(id); depth = Math.max(depth, d);
    for (const kids of Object.values(b.slots ?? {})) if (Array.isArray(kids)) kids.forEach((k) => walk(k, d + 1));
    seen.delete(id);
  };
  if (doc?.root) walk(doc.root, 1);
  return { blocks: Object.keys(blocks).length, depth, types, interactive, stateKeys: Object.keys(doc?.state ?? {}).length, compositions: Object.keys(doc?.compositions ?? {}).length, dataSets: Object.keys(doc?.data ?? {}).length };
}

export interface RenderEvidence { widths: number[]; findings: string[]; /** file paths or ids of the screenshots, when the caller saved them */ shots?: string[]; unavailable?: string }

export interface PacketInputs {
  target: { name: string; version: number; digest: string; system: string; mode: Mode | null; modeSource: "declared" | "inferred" };
  doc: KageDoc;
  workspaceBrief: WorkspaceBrief | null;
  kageBrief: KageBrief | null;
  validation: { errors: number; warnings: number };
  findings: Advice[];
  /** The text view of the Kage (describe()). */
  description: string;
  comments: { openThreads: number; pins: number };
  render?: RenderEvidence;
}

export interface CritiquePacket {
  version: 1;
  target: PacketInputs["target"];
  briefs: { workspace: WorkspaceBrief | null; kage: KageBrief | null };
  evidence: {
    validation: PacketInputs["validation"];
    findings: Advice[];
    stats: PacketStats;
    /** Fenced: describe() output is the Kage's own text. */
    description: string;
    render: RenderEvidence | { unavailable: string };
    comments: PacketInputs["comments"];
  };
  rubric: Rubric;
  protocol: string;
  protocolVersion: number;
}

export const MAX_DESCRIPTION_LINES = 200;

const fence = (s: string) => `<kage-content untrusted="true">\n${s}\n</kage-content>`;
function trim(desc: string): string {
  const lines = desc.split("\n");
  return lines.length <= MAX_DESCRIPTION_LINES ? desc : lines.slice(0, MAX_DESCRIPTION_LINES).join("\n") + `\n… (${lines.length - MAX_DESCRIPTION_LINES} more lines)`;
}

export function buildPacket(i: PacketInputs): CritiquePacket {
  return {
    version: 1,
    target: i.target,
    briefs: { workspace: i.workspaceBrief, kage: i.kageBrief },
    evidence: {
      validation: i.validation,
      findings: [...i.findings].sort((a, b) => (a.severity ?? "P2").localeCompare(b.severity ?? "P2")),
      stats: statsOf(i.doc),
      description: fence(trim(i.description)),
      render: i.render ?? { unavailable: "no render was supplied; judge structure and the findings only" },
      comments: i.comments,
    },
    rubric: RUBRIC,
    protocol: PROTOCOL,
    protocolVersion: PROTOCOL_VERSION,
  };
}
