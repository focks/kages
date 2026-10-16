import { findDeprecated } from "../deprecations.ts";
import type { Rule } from "./types.ts";

export const deprecatedUsage: Rule = {
  id: "deprecated-usage", category: "system", severity: "P2", tier: "immediate",
  summary: "Uses a prop, role, value or field the design system has deprecated.",
  rationale: "Deprecated things still render in stored versions, but new work should not lean on them: they will be removed, and the replacement is already available.",
  check({ doc, deprecations }) {
    return findDeprecated(doc, deprecations).map((u) => ({
      at: u.at,
      msg: `${u.detail} is deprecated (since ${u.entry.since}): ${u.entry.reason}`,
      fix: u.entry.replacement ? `Use ${u.entry.replacement.prop ? "`" + u.entry.replacement.prop + "`" : "`" + u.entry.replacement.role + "`"}${u.entry.auto ? `, or run \`kages migrate\` to do it for you` : ""}.` : "Remove it.",
    }));
  },
};
