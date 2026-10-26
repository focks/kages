import type { Finding, Rule } from "./types.ts";

// The explorer chrome (search, zoom, fit, neighbor highlighting, collapsible
// groups) earns its place on graphs a reader could get lost in. On a small
// ungrouped graph it is the heaviest thing on screen and turns a picture into
// a tool nobody asked for — the failure mode behind agents shipping every
// diagram with `explore:true` by default.
export const needlessExplore: Rule = {
  id: "needless-explore", category: "content", severity: "P3", tier: "deep",
  summary: "Explorer chrome on a small graph with nothing to explore.",
  rationale: "Search, zoom and fit controls outweigh a graph small enough to read at a glance, and collapsible groups — the chrome's main payoff — have no groups to collapse.",
  check({ blocks }) {
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      if (b.type !== "diagram") continue;
      const p = (b.props ?? {}) as Record<string, unknown>;
      if (p.explore !== true) continue;
      // A bound node list can be any size at runtime, so only literal lists are judged.
      const nodes = Array.isArray(p.nodes) ? (p.nodes as unknown[]) : null;
      if (!nodes || nodes.length > 8) continue;
      if (nodes.some((n) => n && typeof n === "object" && (n as Record<string, unknown>).group)) continue;
      out.push({
        at: `/blocks/${id}/props/explore`,
        msg: `\`${id}\` turns on explorer chrome for ${nodes.length} ungrouped nodes; search, zoom and fit outweigh a graph this small.`,
        fix: "Drop explore. Use interactive:true only when the selection drives another block; otherwise leave the diagram static.",
      });
    }
    return out;
  },
};
