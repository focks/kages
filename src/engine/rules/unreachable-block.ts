import type { Rule } from "./types.ts";

export const unreachableBlock: Rule = {
  id: "unreachable-block", category: "structure", severity: "P3", tier: "immediate",
  summary: "A block no slot leads to.",
  rationale: "Harmless to the validator but invisible to readers: leftovers from an edit.",
  check({ blocks, reach, referenced }) {
    return Object.keys(blocks).filter((id) => !reach.has(id) && !referenced.has(id)).map((id) => ({
      at: "/blocks/" + id,
      msg: `Block \`${id}\` is not placed in any slot under the root, so it never renders.`,
      fix: `Add "${id}" to a slot, or delete the block.`,
    }));
  },
};
