// The pure side of the shared-link feedback panel: what the sections menu offers and how a
// submission is validated before it is sent, so the rules the server enforces are visible
// (and tested) in the form as well, and a refusal never reaches a person as a surprise.
import type { KageDoc } from "@/engine/types.ts";

export interface Aspect { id: string; label: string }
export const MAX_TEXT = 2000;

/** Sections with a title, in document order: the places a reviewer is most likely to mean. */
export function aspects(doc: KageDoc): Aspect[] {
  const out: Aspect[] = [], seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id) || !doc.blocks[id]) return; seen.add(id);
    const b = doc.blocks[id], title = (b.props as { title?: unknown } | undefined)?.title;
    if (b.type === "section" && typeof title === "string" && title.trim()) out.push({ id, label: title.trim().slice(0, 60) });
    for (const kids of Object.values((b.slots ?? {}) as Record<string, string[]>)) kids.forEach(walk);
  };
  walk(doc.root);
  return out;
}

export function checkFeedback(name: string, text: string): string | null {
  if (!name.trim()) return "Add your name so the author knows who to thank.";
  if (!text.trim()) return "Write what you noticed.";
  if (text.length > MAX_TEXT) return `Keep it under ${MAX_TEXT} characters (it is ${text.length}).`;
  return null;
}
