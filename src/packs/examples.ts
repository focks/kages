// Complete examples are shared by packs, starter seeding and golden capture.
// Isolated snippets encouraged agents to repeat the reference console's shape;
// these documents demonstrate three independent compositions.
import type { KageDoc, Expr } from "../engine/types.ts";

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

/** Examples exercise collections, formulas and composition outputs together;
 * fresh documents keep the Studio draft independent of published templates. */
export function expressiveExamples(system = "core"): KageDoc[] {
  const base = (id: string, title: string): KageDoc => ({ kages: "1.0", id, title, system: system + "@" + (system === "ledger" ? "2" : "1"), root: "root", blocks: {} });
  const collection = base("collection-lab", "Collection lab — reusable, data-driven cards");
  collection.state = { query: "", selected: "" };
  collection.data = { products: [{ id: "atlas", name: "Atlas", category: "Research", price: 29 }, { id: "canvas", name: "Canvas", category: "Design", price: 49 }, { id: "compass", name: "Compass", category: "Planning", price: 19 }] };
  collection.compositions = {
    product: { inputs: { name: { type: "string", required: true }, category: { type: "string", required: true }, price: { type: "number", required: true } }, root: "card", blocks: {
      card: { type: "section", props: { level: 3, tone: "surface" }, bind: { title: { $input: "name" } }, slots: { children: ["category", "price", "notes"] } },
      category: { type: "text", bind: { text: { $input: "category" } } },
      price: { type: "text", bind: { text: { $format: { value: { $input: "price" }, style: "currency" } } } },
      notes: { type: "text-field", props: { label: "Personal note", placeholder: "Each card keeps its own note" } },
    }, output: { $block: "notes.value" }, outputType: { type: "string" } },
  };
  collection.blocks = {
    root: { type: "page", props: { width: "wide" }, slots: { children: ["intro", "search", "cards", "empty"] } },
    intro: { type: "section", props: { title: "Find your next workspace", eyebrow: "Collection lab", description: "Three cards share one typed composition. Filter the collection; each note survives filtering and reordering.", inset: 0 } },
    search: { type: "text-field", props: { label: "Filter workspaces", placeholder: "Try Design" }, bind: { value: { $state: "query" } }, on: { change: [{ do: "set", path: "query", value: { $event: "value" } }] } },
    cards: { type: "grid", props: { columns: 3, minSize: "small" }, slots: { children: ["product"] } },
    product: { type: "composition", props: { name: "product" }, bind: { inputs: { name: { $item: "name" }, category: { $item: "category" }, price: { $item: "price" } } }, repeat: { each: { $sort: { list: { $filter: { list: { $data: "products" }, fields: ["name", "category"], contains: { $state: "query" } } }, field: "name" } }, key: "id", as: "product" } },
    empty: { type: "text", props: { text: "No matching workspaces. Try a different search." }, visible: { $eq: [{ $count: { $filter: { list: { $data: "products" }, fields: ["name", "category"], contains: { $state: "query" } } } }, 0] } },
  };
  const calculator = base("growth-lab", "Growth lab — a visual calculator");
  calculator.state = { principal: 1000, rate: 5, selected: "" };
  calculator.data = { years: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
  const growth = (year: Expr): Expr => ({ $round: [{ $mul: [{ $state: "principal" }, { $pow: [{ $add: [1, { $div: [{ $state: "rate" }, 100] }] }, year] }] }, 2] });
  calculator.blocks = {
    root: { type: "page", props: { width: "wide" }, slots: { children: ["intro", "workspace", "diagram"] } },
    intro: { type: "section", props: { title: "Watch an idea compound", eyebrow: "Growth lab", description: "Explore how a starting amount and annual rate change a ten-year projection.", inset: 0 } },
    workspace: { type: "split", props: { ratio: "wide-end" }, slots: { start: ["controls"], end: ["plot"] } },
    controls: { type: "section", props: { title: "Try a scenario", level: 3, tone: "surface" }, slots: { children: ["principal", "rate", "result", "explanation"] } },
    principal: { type: "number-input", props: { label: "Starting amount", min: 0, max: 1000000, step: 100 }, bind: { value: { $state: "principal" } }, on: { change: [{ do: "set", path: "principal", value: { $event: "value" } }] } },
    rate: { type: "slider", props: { label: "Annual growth (%)", min: 0, max: 20, step: .5 }, bind: { value: { $state: "rate" } }, on: { change: [{ do: "set", path: "rate", value: { $event: "value" } }] } },
    result: { type: "stat", props: { label: "After ten years", format: "currency" }, bind: { value: growth(10) } },
    explanation: { type: "rich-text", props: { nodes: [{ kind: "paragraph", runs: [{ text: "Explore a hypothetical projection. ", bold: true }, { text: "The curve uses amount × (1 + rate / 100) ^ year. It is a mathematical illustration." }] }, { kind: "code", text: '{"$mul":[{"$state":"principal"},{"$pow":[1.05,10]}]}' }] } },
    plot: { type: "line-chart", props: { label: "Projected growth", xLabel: "Year", yLabel: "Amount" }, bind: { items: { $map: { list: { $data: "years" }, to: { x: { $item: "" }, y: growth({ $item: "" }) } } } } },
    diagram: { type: "diagram", props: { label: "How the projection works", nodes: [{ id: "start", label: "Starting amount" }, { id: "rate", label: "Annual growth" }, { id: "result", label: "Projected amount" }], edges: [{ from: "start", to: "rate" }, { from: "rate", to: "result" }] } },
  };
  const form = base("event-planner", "Event planner — a validated form");
  form.state = { submitted: null };
  form.blocks = {
    root: { type: "page", props: { width: "reading" }, slots: { children: ["intro", "form", "receipt"] } },
    intro: { type: "section", props: { title: "Plan a gathering", description: "Pick a date, group size and activities. Required fields are checked before submission.", inset: 0 } },
    form: { type: "form", props: { label: "Gathering details", submitLabel: "Create plan" }, slots: { children: ["name", "email", "date", "count", "venue", "activities"] }, on: { submit: [{ do: "set", path: "submitted", value: { $event: "values" } }] } },
    name: { type: "text-field", props: { label: "Gathering name", name: "name", required: true, minLength: 3 } },
    email: { type: "text-field", props: { label: "Contact email", name: "email", kind: "email", required: true } },
    date: { type: "date-input", props: { label: "Date", name: "date", required: true } },
    count: { type: "number-input", props: { label: "Group size", name: "count", min: 1, max: 100, step: 1, required: true } },
    venue: { type: "choice", props: { label: "Venue", name: "venue", required: true, options: [{ value: "studio", label: "Studio" }, { value: "garden", label: "Garden" }] } },
    activities: { type: "multiselect", props: { label: "Activities", name: "activities", options: [{ value: "talk", label: "A conversation" }, { value: "workshop", label: "A workshop" }, { value: "exhibition", label: "An exhibition" }] } },
    receipt: { type: "code", props: { caption: "Your plan", wrap: true }, bind: { code: { $tpl: "{{state.submitted}}" } }, visible: { $neq: [{ $state: "submitted" }, null] } },
  };
  return [collection, calculator, form];
}
