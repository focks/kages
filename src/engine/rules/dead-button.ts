import type { Rule } from "./types.ts";

export const deadButton: Rule = {
  id: "dead-button", category: "wiring", severity: "P1", tier: "immediate",
  summary: "A button with no click handler.",
  rationale: "Pressing it does nothing, so the page promises an action it cannot perform. This is the most common wiring slip in generated documents.",
  check({ blocks, handled }) {
    return Object.entries(blocks).filter(([id, b]) => b.type === "button" && !handled.has(id + ":click")).map(([id]) => ({
      at: "/blocks/" + id,
      msg: `Button \`${id}\` has no click handler, so pressing it does nothing.`,
      fix: `Add on.click, for example [{"do":"set","path":"…","value":…}] or a call to another block's command.`,
    }));
  },
};
