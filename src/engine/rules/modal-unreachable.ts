import type { Rule } from "./types.ts";

export const modalUnreachable: Rule = {
  id: "modal-unreachable", category: "wiring", severity: "P1", tier: "immediate",
  summary: "A modal nothing opens.",
  rationale: "A dialog is only shown by a command or by `visible`; with neither, its content can never be reached.",
  check({ blocks, actions }) {
    return Object.entries(blocks).filter(([id, b]) => b.type === "modal" && b.visible === undefined &&
      !actions.some((a) => a.action.do === "call" && a.action.target === id && (a.action.command === "open" || a.action.command === "toggle"))).map(([id]) => ({
      at: "/blocks/" + id,
      msg: `Modal \`${id}\` is never opened: nothing calls its \`open\` command.`,
      fix: `Give a button on.click: [{"do":"call","target":"${id}","command":"open"}].`,
    }));
  },
};
