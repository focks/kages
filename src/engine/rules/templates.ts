import type { Finding, Rule } from "./types.ts";
import { list, nearest } from "./text.ts";

export const tplMissingBlock: Rule = {
  id: "tpl-missing-block", category: "wiring", severity: "P1", tier: "immediate",
  summary: "A template reads a block that does not exist.",
  rationale: "The placeholder renders empty, so text the author meant to be dynamic is silently blank.",
  check({ tplRefs, blocks }) {
    const out: Finding[] = [];
    for (const r of tplRefs) {
      if (r.ns !== "block") continue;
      const [bid] = r.path.split(".");
      if (!blocks[bid]) out.push({ at: r.at, msg: `A template reads \`{{block.${r.path}}}\` but there is no block \`${bid}\`.`, fix: `Fix the id or add the block.` });
    }
    return out;
  },
};

export const tplPrivateRead: Rule = {
  id: "tpl-private-read", category: "wiring", severity: "P1", tier: "immediate",
  summary: "A template reads something that is not a declared output.",
  rationale: "Only declared outputs are readable across blocks; anything else renders empty.",
  check({ tplRefs, blocks, outputsOf }) {
    const out: Finding[] = [];
    for (const r of tplRefs) {
      if (r.ns !== "block") continue;
      const [bid, ...rest] = r.path.split("."), tgt = blocks[bid];
      if (!tgt) continue;
      const outs = outputsOf(tgt.type);
      if (outs.length && !outs.includes(rest[0]))
        out.push({ at: r.at, msg: `A template reads \`{{block.${r.path}}}\`, but \`${rest[0]}\` is not an output of ${tgt.type} (outputs: ${list(outs)}); it renders empty.`, fix: "Read a declared output, or store the value in state and use {{state.key}}." });
    }
    return out;
  },
};

export const tplUndeclaredState: Rule = {
  id: "tpl-undeclared-state", category: "wiring", severity: "P1", tier: "immediate",
  summary: "A template reads a state key that is not declared.",
  rationale: "Undeclared state has no initial value, so the placeholder renders empty until something sets it.",
  check({ tplRefs, stateKeys }) {
    const out: Finding[] = [];
    for (const r of tplRefs) {
      if (r.ns !== "state" || !stateKeys.size || stateKeys.has(r.path.split(".")[0])) continue;
      const guess = nearest(r.path.split(".")[0], [...stateKeys]);
      out.push({ at: r.at, msg: `A template reads \`{{state.${r.path}}}\`, but that state key is not declared; it renders empty.`, fix: guess ? `Did you mean \`${guess}\`?` : `Declare it in \`state\`.` });
    }
    return out;
  },
};
