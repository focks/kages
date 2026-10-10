// Map a validation finding's JSON pointer (`at`) to the field it names, so the
// studio can highlight the exact place: the tree node, and within the inspector
// the offending prop / binding / action. validate() already does the hard part —
// this is just pointer parsing. See src/engine/validate.ts (Finding = {at,code,msg}).

import type { Finding } from "../engine/types.ts";

export type Section = "props" | "bind" | "on" | "slots" | "visible" | "block" | "root";

export interface Field {
  blockId?: string;      // undefined for doc-level findings (/system, /root)
  section: Section;
  key?: string;          // prop name, bound prop, event name, slot name
  index?: number;        // action index within an event, or slot child index
  rest: string[];        // any deeper pointer tokens, untouched
}

// "/blocks/kpi/props/label" → {blockId:"kpi", section:"props", key:"label"}
// "/blocks/kpi/on/click/0"  → {blockId:"kpi", section:"on", key:"click", index:0}
// "/blocks/kpi"             → {blockId:"kpi", section:"block"}
// "/system" | "/root"       → {section:"root"}
export function pointerToField(at: string): Field {
  const t = at.split("/").filter(Boolean); // drop leading ""
  if (t[0] !== "blocks") return { section: "root", rest: t };
  const blockId = t[1];
  const section = (t[2] as Section) ?? "block";
  if (!t[2]) return { blockId, section: "block", rest: [] };
  const key = t[3];
  const maybeIdx = t[4] !== undefined ? Number(t[4]) : NaN;
  return {
    blockId,
    section: ["props", "bind", "on", "slots", "visible"].includes(section) ? section : "block",
    key,
    index: Number.isInteger(maybeIdx) ? maybeIdx : undefined,
    rest: t.slice(5),
  };
}

/** Group findings by block id (plus a "" bucket for doc-level ones) — the tree
 *  uses this to mark which nodes carry an error or warning. */
export function findingsByBlock(findings: Finding[]): Map<string, Finding[]> {
  const m = new Map<string, Finding[]>();
  for (const f of findings) {
    const id = pointerToField(f.at).blockId ?? "";
    (m.get(id) ?? m.set(id, []).get(id)!).push(f);
  }
  return m;
}
