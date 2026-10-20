import type { Finding, Rule } from "./types.ts";

// A stack's `columns` is a fixed track count with no collapse, so on a phone the cells shrink until
// their numbers are clipped; a grid refits to its container. Three stays allowed because the oracle's
// own ops-console fixture uses it and must lint clean; four across is where cards stop fitting at ~360px.
const MAX_FIXED = 3;

export const fixedColumns: Rule = {
  id: "fixed-columns", category: "structure", severity: "P2", tier: "immediate",
  summary: "A stack with four or more fixed columns.",
  rationale: "A stack's columns never collapse, so on a phone each cell is squeezed until its content is clipped. A grid fits as many columns as the container allows and stacks the rest in source order.",
  check({ blocks }): Finding[] {
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      if (b.type !== "stack") continue;
      const n = (b.props as { columns?: unknown } | undefined)?.columns;
      if (typeof n !== "number" || !(n > MAX_FIXED)) continue;
      out.push({
        at: `/blocks/${id}/props/columns`,
        msg: `Stack \`${id}\` fixes ${n} columns; they do not collapse on a narrow screen.`,
        fix: `Change \`${id}\` to a grid with columns: ${n} (and minSize: "small" for compact cards); it keeps ${n} across on desktop and stacks on a phone.`,
      });
    }
    return out;
  },
};
