// Starter content seeded into a NEW user's workspace on first login, so they
// don't land on an empty dashboard. Short "what is Kages" intros built from the
// portable components (page + card + text), alongside complete examples that
// demonstrate editorial, landing and interactive compositions.

import type { KageDoc } from "../engine/types.ts";
import { freeFlowExamples, expressiveExamples, richExamples, appExamples, connectedExamples, chartExamples, contentExamples } from "../packs/examples.ts";

function page(children: string[]): KageDoc["blocks"][string] {
  return { type: "page", props: { width: "reading", gap: 6 }, slots: { children } };
}
function card(children: string[]): KageDoc["blocks"][string] {
  return { type: "card", slots: { children } };
}
function text(value: string): KageDoc["blocks"][string] {
  return { type: "text", props: { text: value } };
}

function doc(id: string, title: string, blocks: KageDoc["blocks"]): KageDoc {
  return { kages: "1.0", id, title, system: "core@1", root: "root", blocks };
}

/** The intro Kages for a fresh workspace. Plain, valid, and self-explanatory. */
export function introKages(): KageDoc[] {
  return [
    doc("welcome", "Welcome to Kages", {
      root: page(["h", "lead", "c1", "c2"]),
      h: text("Welcome to Kages"),
      lead: text("Kages is an artifactory for agents. An agent assembles an interface from blocks against component contracts, and the result is a signed, versioned document — data, never code — that renders anywhere."),
      c1: card(["c1h", "c1b"]),
      c1h: text("Everything is a Kage"),
      c1b: text("Each Kage is an immutable, signed version with provenance: who made it, how, and from what. Edit it and you get a new version; the old one is never lost."),
      c2: card(["c2h", "c2b"]),
      c2h: text("Let an agent edit it"),
      c2b: text("Point an agent at any Kage through the CLI, MCP or REST to add, move and group blocks, edit bindings and actions, and see validation point at the exact field. Publish it and share a link."),
    }),
    doc("what-is-a-block", "Blocks & contracts", {
      root: page(["h", "lead", "c1", "c2"]),
      h: text("Blocks & contracts"),
      lead: text("A block is an instance of a component contract. The contract declares what props, slots, events and commands exist — so you can only set what's allowed, and a Kage is valid by construction."),
      c1: card(["c1h", "c1b"]),
      c1h: text("Bindings wire blocks together"),
      c1b: text("A block reads another block's public outputs through a $block expression. Change a value in one place and everything bound to it updates — no glue code."),
      c2: card(["c2h", "c2b"]),
      c2h: text("Actions respond to events"),
      c2b: text("Events run declarative actions — set state, call a command, ask a model. The runtime applies them as one transaction, so a Kage never ends up half-updated."),
    }),
    doc("design-systems", "Three design systems", {
      root: page(["h", "lead", "c1", "c2"]),
      h: text("Three design systems"),
      lead: text("The same portable document renders in Core, Ledger or Atelier. The design system is chosen when the Kage is created and is fixed after that — a viewer always sees it as the author intended."),
      c1: card(["c1h", "c1b"]),
      c1h: text("Portable by default"),
      c1b: text("Blocks reference roles, not pixels. A Kage built against the shared contracts carries over to another system unchanged; only system-specific extensions stay behind."),
      c2: card(["c2h", "c2b"]),
      c2h: text("Share a link"),
      c2b: text("Publish a Kage and share a /k link. Anyone with the link sees a clean, full-page render in the Kage's own design system, with a Made-with-Kages badge."),
    }),
    ...freeFlowExamples(), ...expressiveExamples(), ...richExamples(), ...appExamples(), ...connectedExamples(), ...chartExamples(), ...contentExamples(),
  ];
}
