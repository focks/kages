// Complete examples are shared by packs, starter seeding and golden capture.
// Isolated snippets encouraged agents to repeat the reference console's shape;
// these documents demonstrate three independent compositions.
import type { KageDoc } from "../engine/types.ts";

/** Fresh documents on every call: studio edits and store lockfiles must never
 * mutate the examples embedded in another agent's pack. */
export function freeFlowExamples(system = "core"): KageDoc[] {
  const doc = (id: string, title: string, blocks: KageDoc["blocks"], state?: KageDoc["state"]): KageDoc => ({
    kages: "1.0", id, title, system: system + "@" + (system === "ledger" ? "2" : "1"), root: "root", blocks, ...(state ? { state } : {}),
  });
  return [
    doc("field-notes", "Field notes — a reading page", {
      root: { type: "page", props: { width: "reading", gap: 8 }, slots: { header: ["title"], children: ["intro", "steps", "rule", "example"], footer: ["footer"] } },
      title: { type: "text", props: { variant: "display", text: "Make room for ideas" } },
      intro: { type: "section", props: { title: "Start with the content", description: "A report can be a single flowing page. Choose navigation only when the reader needs it.", inset: 0 } },
      steps: { type: "list", props: { ordered: true, items: ["Choose a reading, wide or full canvas.", "Compose sections, imagery and interactive blocks.", "Use grids and splits when the content benefits from comparison."] } },
      rule: { type: "divider" },
      example: { type: "code", props: { caption: "A complete minimal page", language: "json", wrap: true, code: '{"kages":"1.0","id":"note","title":"A note","system":"core@1","root":"note","blocks":{"note":{"type":"text","props":{"text":"Any block can be the root."}}}}' } },
      footer: { type: "text", props: { variant: "caption", text: "Built from portable blocks." } },
    }),
    doc("open-studio", "Open studio — a landing page", {
      root: { type: "page", props: { width: "wide", gap: 8 }, slots: { children: ["hero", "features", "closing"] } },
      hero: { type: "section", props: { eyebrow: "A space for your next idea", title: "Create something that feels like yours", description: "Stories, tools and explorations can share a design system without sharing a layout.", tone: "accent", inset: 8 }, slots: { actions: ["explore"] } },
      explore: { type: "button", props: { label: "Explore the possibilities", variant: "primary" }, on: { click: [{ do: "toggle", path: "showDetails" }] } },
      features: { type: "grid", props: { columns: 3, minSize: "small", gap: 6 }, slots: { children: ["story", "tool", "gallery"] } },
      story: { type: "section", props: { title: "Tell a story", level: 3, tone: "surface", description: "Reading-width prose, captions, lists and code examples." } },
      tool: { type: "section", props: { title: "Build a tool", level: 3, tone: "surface", description: "Inputs and outputs side by side, with state connecting them." } },
      gallery: { type: "section", props: { title: "Show the work", level: 3, tone: "surface", description: "Images and feature cards in a grid that fits the available space." } },
      closing: { type: "section", props: { title: "Choose your own shape", description: "Start with a page, section, grid, split, stack or a single block. Add tabs or a sidebar when they help the experience.", inset: 0 }, visible: { $state: "showDetails" } },
    }, { showDetails: false }),
    doc("idea-lab", "Idea lab — an interactive split tool", {
      root: { type: "page", props: { width: "wide", gap: 6 }, slots: { header: ["heading"], children: ["workspace"] } },
      heading: { type: "section", props: { eyebrow: "An interactive exploration", title: "Give your idea a little space", description: "Write a draft, adjust your confidence and compare possible directions. Everything updates in place.", inset: 0 } },
      workspace: { type: "split", props: { ratio: "equal", gap: 8 }, slots: { start: ["inputs"], end: ["outputs"] } },
      inputs: { type: "section", props: { title: "Your starting point", level: 3, tone: "surface" }, slots: { children: ["draft", "confidence", "details"] } },
      draft: { type: "textarea", props: { label: "Draft an idea", rows: 5, placeholder: "What would you like to make?" }, bind: { value: { $state: "draft" } }, on: { change: [{ do: "set", path: "draft", value: { $event: "value" } }] } },
      confidence: { type: "slider", props: { label: "Confidence", min: 0, max: 100, step: 5 }, bind: { value: { $state: "confidence" } }, on: { change: [{ do: "set", path: "confidence", value: { $event: "value" } }] } },
      details: { type: "checkbox", props: { label: "Show a structured draft" } },
      outputs: { type: "section", props: { title: "Where it could go", level: 3, inset: 0 }, slots: { children: ["summary", "comparison", "structured"] } },
      summary: { type: "text", bind: { text: { $tpl: "Your idea: {{state.draft}}\nConfidence: {{state.confidence}}%" } } },
      comparison: { type: "bar-chart", props: { label: "Possible directions" }, bind: { items: [{ label: "Story", value: 70 }, { label: "Interactive tool", value: { $state: "confidence" } }, { label: "Visual collection", value: 45 }] } },
      structured: { type: "code", props: { caption: "Your draft as data", wrap: true }, bind: { code: { $tpl: "Draft: {{state.draft}}\nConfidence: {{state.confidence}}" } }, visible: { $block: "details.checked" } },
    }, { draft: "A small tool for a big idea", confidence: 60 }),
  ];
}
