import type { Finding, Rule } from "./types.ts";

export const duplicateItemId: Rule = {
  id: "duplicate-item-id", category: "structure", severity: "P2", tier: "immediate",
  summary: "Two items in one list share an id.",
  rationale: "Items are selected and tracked by id, so selecting one selects both.",
  check({ blocks }) {
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      const p = (b.props ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(p)) {
        if (!(Array.isArray(v) && v.length > 1 && v.every((x) => x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string"))) continue;
        const ids = (v as { id: string }[]).map((x) => x.id), dup = ids.find((x, i) => ids.indexOf(x) !== i);
        if (dup !== undefined) out.push({ at: `/blocks/${id}/props/${k}`, msg: `\`${k}\` of \`${id}\` repeats the id "${dup}"; selecting one will select both.`, fix: "Give each item a unique id." });
      }
    }
    return out;
  },
};
