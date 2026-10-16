import type { Finding, Rule } from "./types.ts";

export const tocMissingAnchor: Rule = {
  id: "toc-missing-anchor", category: "structure", severity: "P2", tier: "immediate",
  summary: "An outline entry whose anchor does not exist.",
  rationale: "The link scrolls nowhere, which makes a long page's navigation look broken.",
  check({ blocks }) {
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      if (b.type !== "toc") continue;
      const p = (b.props ?? {}) as Record<string, unknown>;
      for (const [i, it] of (Array.isArray(p.items) ? p.items : []).entries()) {
        const target = String((it as { target?: unknown })?.target ?? "");
        if (!Object.values(blocks).some((x) => x.type === "anchor" && String((x.props as { name?: unknown })?.name ?? "") === target))
          out.push({ at: `/blocks/${id}/props/items/${i}`, msg: `The outline links to \`${target}\`, but no anchor block has that name; the link goes nowhere.`, fix: `Add {"type":"anchor","props":{"name":"${target}"}} before the heading.` });
      }
    }
    return out;
  },
};
