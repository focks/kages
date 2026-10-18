import type { Finding, Rule } from "./types.ts";

/** Where the sources are: item id -> 1-based position in its `references` block. */
function sources(blocks: Record<string, { type: string; props?: unknown }>): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of Object.values(blocks)) {
    if (b.type !== "references") continue;
    const items = (b.props as { items?: unknown })?.items;
    (Array.isArray(items) ? items : []).forEach((it, i) => { const id = (it as { id?: unknown })?.id; if (typeof id === "string" && !out.has(id)) out.set(id, i + 1); });
  }
  return out;
}

export const danglingCite: Rule = {
  id: "dangling-cite", category: "content", severity: "P2", tier: "immediate",
  summary: "A citation that points at a source the page does not list, or shows the wrong number.",
  rationale: "A superscript number is a promise that the claim has a source. If the id is missing the link goes nowhere, and if the number disagrees with the list the reader checks the wrong source.",
  check({ blocks }) {
    const known = sources(blocks), out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      if (b.type !== "rich-text") continue;
      const nodes = (b.props as { nodes?: unknown })?.nodes;
      (Array.isArray(nodes) ? nodes : []).forEach((node, n) => {
        const runs = (node as { runs?: unknown })?.runs;
        (Array.isArray(runs) ? runs : []).forEach((run, r) => {
          const cite = (run as { cite?: unknown })?.cite;
          if (typeof cite !== "string") return;
          const at = `/blocks/${id}/props/nodes/${n}/runs/${r}`, pos = known.get(cite);
          if (pos === undefined) out.push({ at, msg: `The citation \`${cite}\` has no matching item in a references block; the link goes nowhere.`, fix: `Add {"id":"${cite}","label":"…","href":"https://…"} to a references block, or remove the cite.` });
          else if (String((run as { text?: unknown }).text) !== String(pos)) out.push({ at, msg: `The citation \`${cite}\` shows "${String((run as { text?: unknown }).text)}" but its source is number ${pos} in the list.`, fix: `Set the run text to "${pos}".` });
        });
      });
    }
    return out;
  },
};
