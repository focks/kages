import type { Rule } from "./types.ts";

export const formUnwired: Rule = {
  id: "form-unwired", category: "wiring", severity: "P1", tier: "immediate",
  summary: "A form with no submit handler.",
  rationale: "Submitted values are discarded, so the reader fills in a form that goes nowhere.",
  check({ blocks, handled }) {
    return Object.entries(blocks).filter(([id, b]) => b.type === "form" && !handled.has(id + ":submit")).map(([id]) => ({
      at: "/blocks/" + id,
      msg: `Form \`${id}\` has no submit handler; submitted values are discarded.`,
      fix: `Add on.submit: [{"do":"set","path":"submitted","value":{"$event":"values"}}] and declare that state key.`,
    }));
  },
};
