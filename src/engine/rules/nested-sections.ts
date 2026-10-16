import type { Block, KageDoc } from "../types.ts";
import type { Finding, Rule } from "./types.ts";

// How many container levels a system tolerates before a nested one is reported.
// Every system is 1 today (a container may not sit inside another). The knob exists
// so Ledger could one day allow 2 for dense data panes without a new rule.
const MAX_DEPTH: Record<string, number> = {};
const maxDepthFor = (system: string) => MAX_DEPTH[system.split("@")[0]] ?? 1;

const TONED = new Set(["surface", "sunken", "accent"]);
/** A container is something the reader sees as a box: a card, or a section with a tone.
 *  A plain section is only spacing and a heading. */
export function isContainer(b: Block | undefined): boolean {
  if (!b) return false;
  if (b.type === "card") return true;
  return b.type === "section" && TONED.has(String((b.props as { tone?: unknown } | undefined)?.tone));
}

/** A block starts a new visual context: an overlay, or workspace chrome. */
const resets = (b: Block) => b.type === "modal" || b.type === "shell";

function walk(blocks: Record<string, Block>, root: string, limit: number, compositionIsContainer: (b: Block) => boolean, out: Finding[], atPrefix: string): void {
  const seen = new Set<string>();
  const visit = (id: string, chain: string[], depth: number) => {
    const b = blocks[id];
    if (!b || typeof b !== "object" || seen.has(id)) return;
    seen.add(id);
    const label = `${b.type}#${id}`;
    const container = isContainer(b) || (b.type === "composition" && compositionIsContainer(b));
    if (container && depth >= limit) out.push({
      at: `${atPrefix}/blocks/${id}`,
      msg: `\`${id}\` is a ${b.type === "section" ? "toned section" : b.type} inside another container (${[...chain, label].join(" › ")}); nested boxes add depth and noise.`,
      fix: "Make the outer section plain (leave tone out), or drop the inner card: group with spacing and heading level instead.",
    });
    const nextDepth = resets(b) ? 0 : container ? depth + 1 : depth;
    const nextChain = resets(b) ? [] : [...chain, label];
    for (const kids of Object.values(b.slots ?? {})) if (Array.isArray(kids)) for (const k of kids) visit(k, nextChain, nextDepth);
  };
  visit(root, [], 0);
}

export const nestedSections: Rule = {
  id: "nested-sections", category: "structure", severity: "P2", tier: "immediate",
  summary: "A card or toned section inside another card or toned section.",
  rationale: "Boxes inside boxes add visual depth and waste width on a phone. Spacing, headings and one level of container say the same thing more quietly.",
  check({ doc, system }): Finding[] {
    const out: Finding[] = [];
    const limit = maxDepthFor(system);
    const comps = (doc as KageDoc).compositions ?? {};
    const rootIsContainer = (name: unknown) => { const c = typeof name === "string" ? comps[name] : undefined; return !!c && isContainer(c.blocks?.[c.root]); };
    walk(doc.blocks, doc.root, limit, (b) => rootIsContainer((b.props as { name?: unknown } | undefined)?.name), out, "");
    // A composition's own blocks are analysed on their own; its use-site is handled above.
    for (const [name, c] of Object.entries(comps)) if (c && typeof c === "object" && c.blocks && c.root) walk(c.blocks, c.root, limit, () => false, out, `/compositions/${name}`);
    return out;
  },
};
