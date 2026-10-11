// catalog(): compact text an agent skill can embed, listing a system's
// components with their props, slots, events, outputs, commands and guidance.
// Ported from the oracle. See oracle/agent-access.feature.

import { systems, contracts } from "./data.ts";
import authoring from "./data/authoring.json" with { type: "json" };

export function catalog(systemId: string): string {
  const sys = systems[systemId];
  const out: string[] = [
    "# " + sys.name + " " + sys.version + " (" + sys.id + ")" + (sys.extends ? " extends " + sys.extends : ""),
    sys.summary,
    authoring.composition,
    "",
  ];
  Object.keys(sys.components).forEach((name) => {
    const c = contracts[sys.components[name]];
    const props = Object.keys(c.props)
      .map((k) => { const s = c.props[k]; return k + (s.required ? "*" : "") + ":" + (s.enum ? s.enum.join("|") : s.type); })
      .join(", ");
    out.push("- " + name + " → " + c.ref + " [" + c.implements[0] + "] " + c.summary);
    out.push(
      "  props: " + props +
      (Object.keys(c.slots).length ? " · slots: " + Object.keys(c.slots).join(", ") : "") +
      (Object.keys(c.events).length ? " · events: " + Object.keys(c.events).join(", ") : "") +
      (c.outputs.length ? " · outputs: " + c.outputs.join(", ") : "") +
      (Object.keys(c.commands).length ? " · commands: " + Object.keys(c.commands).join(", ") : ""),
    );
    // New authoring guidance must reach catalog-only clients too. Published
    // refs keep their metadata, and structural Ledger/Atelier overrides keep
    // their specific advice rather than inheriting Core's presentation notes.
    const guidance = authoring.guidance as Record<string, { use: string; avoid?: string }>;
    const notes = c.system === "core" ? guidance[name] ?? c.agent : c.agent;
    if (notes.use) out.push("  use: " + notes.use + (notes.avoid ? " · avoid: " + notes.avoid : ""));
  });
  return out.map((line) => line.trimEnd()).join("\n");
}
