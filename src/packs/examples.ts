// Complete examples are shared by packs, starter seeding and golden capture.
// Isolated snippets encouraged agents to repeat the reference console's shape;
// these documents demonstrate three independent compositions.
import type { KageDoc, Expr, Mode } from "../engine/types.ts";
import { useCaseExamples, USE_CASE_MODES } from "./use-case-examples.ts";
import { guideExamples } from "./guide-examples.ts";
import { showcaseExamples } from "./showcase-examples.ts";
import { polishExamples } from "./polish-examples.ts";

/** Every shipped example declares what its visitor is trying to do, so the mode
 *  facet, mode-gated lint and the critique rubric have real data from day one.
 *  Read-only here: the engine goldens are unaffected because the generation
 *  envelope does not carry `brief`. */
const MODES: Record<string, Mode> = {
  "field-notes": "read", "math-notes": "read", "docs-guide": "read", "research-brief": "read",
  "open-studio": "persuade", "media-gallery": "experience",
  "idea-lab": "operate", "collection-lab": "operate", "growth-lab": "operate", "event-planner": "operate",
  "metrics-board": "operate", "launch-flow": "operate", "team-workbench": "operate", "region-explorer": "operate",
  "live-feed": "operate", "signup-rules": "operate", "quarterly-report": "operate",
  ...USE_CASE_MODES,
};
const declared = (docs: KageDoc[]): KageDoc[] => docs.map((d) => (MODES[d.id] ? { ...d, brief: { mode: MODES[d.id] } } : d));

/** Fresh documents on every call: edits and store lockfiles must never
 * mutate the examples embedded in another agent's pack. */
export function freeFlowExamples(system = "core"): KageDoc[] {
  const doc = (id: string, title: string, blocks: KageDoc["blocks"], state?: KageDoc["state"]): KageDoc => ({
    kages: "1.0", id, title, system: system + "@" + (system === "ledger" ? "2" : "1"), root: "root", blocks, ...(state ? { state } : {}),
  });
  return declared([
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
  ]);
}

/** Examples exercise collections, formulas and composition outputs together;
 * fresh documents keep a new Kage independent of published templates. */
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
  return declared([collection, calculator, form]);
}

/** Batch 1 of the rich roles: a data-viz board and a guided flow. Kept apart
 * from expressiveExamples so existing tests that index those documents by
 * position stay valid. */
export function richExamples(system = "core"): KageDoc[] {
  const base = (id: string, title: string): KageDoc => ({ kages: "1.0", id, title, system: system + "@" + (system === "ledger" ? "2" : "1"), root: "root", blocks: {} });
  const board = base("metrics-board", "Metrics board — charts at a glance");
  board.data = { weeks: [{ x: 1, y: 120 }, { x: 2, y: 180 }, { x: 3, y: 150 }, { x: 4, y: 240 }, { x: 5, y: 310 }, { x: 6, y: 280 }] };
  board.blocks = {
    root: { type: "page", props: { width: "wide", gap: 6 }, slots: { children: ["intro", "notice", "kpis", "trend", "mix"] } },
    intro: { type: "section", props: { eyebrow: "Metrics board", title: "How the launch is going", description: "Trend, composition, capacity and intensity in one flowing page.", inset: 0 } },
    notice: { type: "alert", props: { tone: "warning", title: "Preview data", text: "Figures are illustrative." } },
    kpis: { type: "grid", props: { columns: 3, minSize: "small" }, slots: { children: ["signups", "capacity", "weekly"] } },
    signups: { type: "stat", props: { label: "Signups", format: "number" }, bind: { value: { $count: { $data: "weeks" } } } },
    capacity: { type: "gauge", props: { label: "Capacity used", value: 72, unit: "%", tone: "success" } },
    weekly: { type: "section", props: { title: "Weekly signups", level: 3, tone: "surface" }, slots: { children: ["trendline"] } },
    trendline: { type: "sparkline", props: { label: "Weekly signups", values: [120, 180, 150, 240, 310, 280] } },
    trend: { type: "area-chart", props: { label: "Signups per week", xLabel: "Week", yLabel: "Signups" }, bind: { items: { $data: "weeks" } } },
    mix: { type: "split", props: { ratio: "equal", gap: 6 }, slots: { start: ["channels"], end: ["activity"] } },
    channels: { type: "donut-chart", props: { label: "Signups by channel", items: [{ label: "Search", value: 48 }, { label: "Referral", value: 31 }, { label: "Social", value: 21 }] } },
    activity: { type: "heatmap", props: { label: "Activity by day and slot", rows: ["Mon", "Tue", "Wed"], columns: ["AM", "Noon", "PM"], values: [[3, 8, 5], [6, 9, 2], [1, 4, 7]] } },
  };
  const flow = base("launch-flow", "Launch flow — a guided checklist");
  flow.state = { step: "plan", faq: "" };
  flow.blocks = {
    root: { type: "page", props: { width: "reading", gap: 6 }, slots: { children: ["intro", "stepper", "panel", "help", "history", "openConfirm", "dialog"] } },
    intro: { type: "section", props: { title: "Ship it in three steps", description: "Move through the steps; the content below follows the current step.", inset: 0 } },
    stepper: { type: "stepper", props: { label: "Launch steps", interactive: true, steps: [{ id: "plan", label: "Plan", description: "Scope the work" }, { id: "build", label: "Build" }, { id: "ship", label: "Ship" }] }, bind: { value: { $state: "step" } }, on: { change: [{ do: "set", path: "step", value: { $event: "value" } }] } },
    panel: { type: "alert", props: { tone: "info" }, bind: { title: { $tpl: "Current step: {{state.step}}" } } },
    help: { type: "accordion", props: { items: [{ id: "what", title: "What happens at launch?", body: "The artifact is published as an immutable version." }, { id: "undo", title: "Can I undo it?", body: "Publish a new version; earlier versions stay available." }] }, bind: { value: { $state: "faq" } }, on: { change: [{ do: "set", path: "faq", value: { $event: "value" } }] } },
    history: { type: "timeline", props: { label: "Recent activity", items: [{ title: "Draft created", time: "Mon", tone: "accent" }, { title: "Review requested", time: "Tue", description: "Two reviewers assigned." }, { title: "Approved", time: "Wed", tone: "success" }] } },
    openConfirm: { type: "button", props: { label: "Launch now", variant: "primary" }, on: { click: [{ do: "call", target: "dialog", command: "open" }] } },
    dialog: { type: "modal", props: { label: "Launch this artifact?" }, slots: { children: ["sure", "go"] } },
    sure: { type: "text", props: { text: "This publishes a new version for everyone with access." } },
    go: { type: "button", props: { label: "Confirm", variant: "primary" }, on: { click: [{ do: "call", target: "dialog", command: "close" }] } },
  };
  return declared([board, flow]);
}

/** Batch 2 of the rich roles: a work-app board and a media-rich reading page. */
export function appExamples(system = "core"): KageDoc[] {
  const base = (id: string, title: string): KageDoc => ({ kages: "1.0", id, title, system: system + "@" + (system === "ledger" ? "2" : "1"), root: "root", blocks: {} });
  const bench = base("team-workbench", "Team workbench — tasks, schedule and people");
  bench.state = { owner: "", notify: true };
  bench.data = { people: [{ value: "ada", label: "Ada Lovelace" }, { value: "alan", label: "Alan Turing" }, { value: "grace", label: "Grace Hopper" }], roster: [{ name: "Ada", team: "Engine", load: 70 }, { name: "Alan", team: "Runtime", load: 45 }, { name: "Grace", team: "Engine", load: 90 }] };
  bench.blocks = {
    root: { type: "page", props: { width: "full", gap: 6 }, slots: { children: ["intro", "controls", "board", "lower"] } },
    intro: { type: "section", props: { eyebrow: "Team workbench", title: "Plan the sprint", description: "Move cards, pick dates, search people and sort the roster.", inset: 0 } },
    controls: { type: "split", props: { ratio: "equal", gap: 6 }, slots: { start: ["owner"], end: ["notify"] } },
    owner: { type: "combobox", props: { label: "Sprint owner", placeholder: "Search people", options: [{ value: "ada", label: "Ada Lovelace" }, { value: "alan", label: "Alan Turing" }, { value: "grace", label: "Grace Hopper" }] }, bind: { value: { $state: "owner" } }, on: { change: [{ do: "set", path: "owner", value: { $event: "value" } }] } },
    notify: { type: "switch", props: { label: "Notify the team" }, bind: { checked: { $state: "notify" } }, on: { change: [{ do: "set", path: "notify", value: { $event: "checked" } }] } },
    board: { type: "kanban", props: { label: "Sprint board", columns: [{ id: "todo", title: "To do" }, { id: "doing", title: "Doing" }, { id: "done", title: "Done" }], cards: [{ id: "c1", title: "Draft contracts", column: "todo", description: "Interfaces for each role" }, { id: "c2", title: "Build goldens", column: "doing" }, { id: "c3", title: "Ship docs", column: "done" }] } },
    lower: { type: "grid", props: { columns: 3, minSize: "large", gap: 6 }, slots: { children: ["roster", "schedule", "areas"] } },
    roster: { type: "data-grid", props: { label: "Roster", pageSize: 5, filterable: true, columns: [{ key: "name", label: "Name" }, { key: "team", label: "Team" }, { key: "load", label: "Load %" }] }, bind: { rows: { $data: "roster" } } },
    schedule: { type: "calendar", props: { label: "Sprint calendar", month: "2026-03", events: [{ date: "2026-03-04", title: "Planning" }, { date: "2026-03-18", title: "Demo" }] } },
    areas: { type: "tree", props: { label: "Work areas", expandAll: true, nodes: [{ id: "eng", label: "Engineering", children: [{ id: "engine", label: "Engine" }, { id: "runtime", label: "Runtime" }] }, { id: "design", label: "Design" }] } },
  };
  const read = base("math-notes", "Math notes — markdown, math and slides");
  read.blocks = {
    root: { type: "page", props: { width: "reading", gap: 6 }, slots: { children: ["body", "formula", "series", "matrix", "piecewise", "slides"] } },
    body: { type: "markdown", props: { text: "## Why compounding wins\n\nA balance grows by a factor of **(1 + r)** each year, so after *n* years it is $P(1+r)^n$. Read more at [the docs](https://example.com/docs).\n\n- Start early\n- Be consistent\n\n> Time in the market beats timing the market.\n\n```\nbalance = principal * (1 + rate) ** years\n```" } },
    formula: { type: "math", props: { display: true, label: "Compound growth", tex: "A = P\\left(1 + \\frac{r}{n}\\right)^{nt}" } },
    series: { type: "math", props: { display: true, label: "Sum of squares", tex: "\\sum_{i=1}^{n} i^{2} = \\frac{n(n+1)(2n+1)}{6}" } },
    matrix: { type: "math", props: { display: true, label: "Rotation matrix", tex: "R(\\theta) = \\begin{pmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{pmatrix}" } },
    piecewise: { type: "math", props: { display: true, label: "Absolute value", tex: "|x| = \\begin{cases} x & x \\geq 0 \\\\ -x & x < 0 \\end{cases}" } },
    slides: { type: "carousel", props: { label: "Three habits", slides: [{ title: "Automate", text: "Pay yourself first." }, { title: "Diversify", text: "Spread the risk." }, { title: "Wait", text: "Let time do the work." }] } },
  };
  return declared([bench, read]);
}

/** Batch 3: connected blocks. A chart selection filters a table, a declared
 * source loads live data (falling back to its mock offline), and ordinary
 * visible/disabled/when expressions act as conditional rules. */
export function connectedExamples(system = "core"): KageDoc[] {
  const base = (id: string, title: string): KageDoc => ({ kages: "1.0", id, title, system: system + "@" + (system === "ledger" ? "2" : "1"), root: "root", blocks: {} });
  const explorer = base("region-explorer", "Region explorer — click a slice to filter");
  explorer.data = { deals: [{ id: "d1", name: "Northwind", region: "North", value: 120 }, { id: "d2", name: "Contoso", region: "South", value: 80 }, { id: "d3", name: "Fabrikam", region: "North", value: 60 }, { id: "d4", name: "Tailspin", region: "West", value: 45 }] };
  explorer.blocks = {
    root: { type: "page", props: { width: "wide", gap: 6 }, slots: { children: ["intro", "layout"] } },
    intro: { type: "section", props: { eyebrow: "Region explorer", title: "Where is the pipeline?", description: "Select a slice (or press Enter on it) to filter the deals; select it again to clear.", inset: 0 } },
    layout: { type: "split", props: { ratio: "equal", gap: 6 }, slots: { start: ["mix"], end: ["table", "caption"] } },
    mix: { type: "donut-chart", props: { label: "Pipeline value by region", interactive: true, items: [{ label: "North", value: 180 }, { label: "South", value: 80 }, { label: "West", value: 45 }] } },
    table: { type: "data-grid", props: { label: "Deals", sortable: true, columns: [{ key: "name", label: "Deal" }, { key: "region", label: "Region" }, { key: "value", label: "Value" }] }, bind: { rows: { $filter: { list: { $data: "deals" }, field: "region", equals: { $block: "mix.selected" }, skipIf: "" } } } },
    caption: { type: "text", props: { variant: "caption" }, bind: { text: { $concat: ["Showing ", { $count: { $filter: { list: { $data: "deals" }, field: "region", equals: { $block: "mix.selected" }, skipIf: "" } } }, " of 4 deals"] } } },
  };
  const feed = base("live-feed", "Live feed — a declared data source");
  feed.state = { items: [], loading: false };
  feed.sources = { headlines: { from: "url", url: "https://api.example.com/headlines.json", path: "items", maxItems: 20 } };
  feed.blocks = {
    root: { type: "page", props: { width: "reading", gap: 6 }, slots: { children: ["intro", "load", "list"] } },
    intro: { type: "section", props: { title: "Headlines", description: "Loads from a declared source when the host allows it; otherwise shows the built-in sample.", inset: 0 } },
    load: { type: "button", props: { label: "Load headlines", variant: "primary" }, bind: { disabled: { $state: "loading" } }, on: { click: [{ do: "fetch", source: "headlines", into: "items", pendingInto: "loading", mock: [{ title: "Sample headline one", time: "Now" }, { title: "Sample headline two", time: "1h ago" }] }] } },
    list: { type: "timeline", props: { label: "Headlines" }, bind: { items: { $state: "items" } } },
  };
  const rules = base("signup-rules", "Signup rules — conditional behaviour");
  rules.state = { age: null, consent: false, submitted: false };
  const eligible: Expr = { $and: [{ $neq: [{ $state: "age" }, null] }, { $gte: [{ $state: "age" }, 18] }, { $state: "consent" }] };
  rules.blocks = {
    root: { type: "page", props: { width: "reading", gap: 6 }, slots: { children: ["intro", "age", "consent", "minor", "submit", "done"] } },
    intro: { type: "section", props: { title: "Join the programme", description: "Rules: adults only, with consent. The button enables itself when both hold.", inset: 0 } },
    age: { type: "number-input", props: { label: "Your age", min: 0, max: 120, step: 1 }, bind: { value: { $state: "age" } }, on: { change: [{ do: "set", path: "age", value: { $event: "value" } }] } },
    consent: { type: "switch", props: { label: "I agree to the terms" }, bind: { checked: { $state: "consent" } }, on: { change: [{ do: "set", path: "consent", value: { $event: "checked" } }] } },
    minor: { type: "alert", props: { tone: "warning", title: "Adults only", text: "You must be 18 or older to join." }, visible: { $and: [{ $neq: [{ $state: "age" }, null] }, { $lt: [{ $state: "age" }, 18] }] } },
    submit: { type: "button", props: { label: "Join", variant: "primary" }, bind: { disabled: { $not: eligible } }, on: { click: [{ do: "set", path: "submitted", value: true, when: eligible }] } },
    done: { type: "alert", props: { tone: "success", title: "You're in", text: "Welcome aboard." }, visible: { $state: "submitted" } },
  };
  return declared([explorer, feed, rules]);
}

/** Batch 4: the richer charts together on one reporting page. */
export function chartExamples(system = "core"): KageDoc[] {
  const doc: KageDoc = { kages: "1.0", id: "quarterly-report", title: "Quarterly report — six ways to see the data", system: system + "@" + (system === "ledger" ? "2" : "1"), root: "root", blocks: {} };
  const sq = (x: number, y: number, w: number, h: number) => ({ type: "Polygon", coordinates: [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]] });
  doc.state = {};
  doc.blocks = {
    root: { type: "page", props: { width: "wide", gap: 8 }, slots: { children: ["intro", "trend", "stack", "pipeline", "split", "flows", "regions"] } },
    intro: { type: "section", props: { eyebrow: "Quarterly report", title: "How the quarter went", description: "Revenue against target, the mix behind it, the sales funnel, where costs go, how money moves and how regions compare.", inset: 0 } },
    trend: { type: "combo-chart", props: { label: "Revenue vs target", xLabel: "Month", categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], series: [{ name: "Revenue", kind: "bar", values: [120, 135, 150, 142, 170, 190] }, { name: "Target", kind: "line", values: [125, 130, 140, 150, 160, 175] }] } },
    stack: { type: "stacked-bar-chart", props: { label: "Revenue by product line", categories: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Platform", values: [60, 70, 85, 95] }, { name: "Services", values: [30, 32, 35, 38] }, { name: "Support", values: [20, 22, 21, 25] }] } },
    pipeline: { type: "funnel-chart", props: { label: "Sales funnel", interactive: true, stages: [{ label: "Visitors", value: 12000 }, { label: "Signups", value: 3400 }, { label: "Trials", value: 1200 }, { label: "Customers", value: 380 }] } },
    split: { type: "split", props: { ratio: "equal", gap: 6 }, slots: { start: ["costs"], end: ["picked"] } },
    costs: { type: "treemap", props: { label: "Where the budget goes", interactive: true, items: [{ label: "Engineering", value: 48 }, { label: "Sales", value: 24 }, { label: "Marketing", value: 14 }, { label: "Support", value: 9 }, { label: "Operations", value: 5 }] } },
    picked: { type: "text", props: { variant: "caption" }, bind: { text: { $tpl: "Selected — budget area: {{block.costs.selected}} · funnel stage: {{block.pipeline.selected}} · region: {{block.regions.selected}}" } } },
    flows: { type: "sankey", props: { label: "From budget to outcomes", nodes: [{ id: "budget", label: "Budget" }, { id: "build", label: "Build" }, { id: "grow", label: "Grow" }, { id: "features", label: "Features" }, { id: "fixes", label: "Fixes" }, { id: "leads", label: "Leads" }], links: [{ from: "budget", to: "build", value: 60 }, { from: "budget", to: "grow", value: 40 }, { from: "build", to: "features", value: 40 }, { from: "build", to: "fixes", value: 20 }, { from: "grow", to: "leads", value: 40 }] } },
    regions: { type: "map", props: { label: "Customers by region", interactive: true, features: [{ id: "north", name: "North", value: 120, geometry: sq(0, 5, 10, 5) }, { id: "west", name: "West", value: 45, geometry: sq(-6, 0, 6, 5) }, { id: "east", name: "East", value: 80, geometry: sq(0, 0, 6, 5) }, { id: "south", name: "South", value: 20, geometry: sq(-2, -5, 8, 5) }] } },
  };
  return declared([doc]);
}


/** Batch 5: structure, media and forms — a documentation page and a media page. */
export function contentExamples(system = "core"): KageDoc[] {
  const base = (id: string, title: string): KageDoc => ({ kages: "1.0", id, title, system: system + "@" + (system === "ledger" ? "2" : "1"), root: "root", blocks: {} });
  const docs = base("docs-guide", "Docs guide — outline, tabs, code and validated fields");
  docs.state = { age: null, period: { start: "", end: "" } };
  const heading = (text: string) => ({ type: "rich-text", props: { nodes: [{ kind: "heading", level: 2, text }] } });
  docs.blocks = {
    root: { type: "page", props: { width: "wide", gap: 8 }, slots: { children: ["intro", "layout"] } },
    intro: { type: "section", props: { eyebrow: "Documentation", title: "Getting started", description: "A long page with an outline that follows you, tabbed alternatives, copyable code and fields that explain themselves.", inset: 0 } },
    layout: { type: "split", props: { ratio: "wide-end", gap: 8 }, slots: { start: ["toc"], end: ["a-install", "h-install", "platforms", "a-usage", "h-usage", "snippet", "a-check", "h-check", "age", "period", "report"] } },
    toc: { type: "toc", props: { title: "On this page", sticky: true, items: [{ label: "Install", target: "install" }, { label: "Usage", target: "usage" }, { label: "Check your details", target: "check" }] } },
    "a-install": { type: "anchor", props: { name: "install" } },
    "h-install": heading("Install"),
    platforms: { type: "tab-panel", props: { label: "Platform", tabs: [{ id: "mac", label: "macOS" }, { id: "linux", label: "Linux" }, { id: "win", label: "Windows" }] }, slots: { panel1: ["mac"], panel2: ["linux"], panel3: ["win"] } },
    mac: { type: "text", props: { text: "Install with Homebrew, then restart your terminal." } },
    linux: { type: "text", props: { text: "Use your package manager or download the static binary." } },
    win: { type: "text", props: { text: "Use the installer or winget." } },
    "a-usage": { type: "anchor", props: { name: "usage" } },
    "h-usage": heading("Usage"),
    snippet: { type: "code-tabs", props: { caption: "List your Kages", tabs: [{ id: "sh", label: "Shell", language: "sh", code: "kages ls --json" }, { id: "js", label: "JavaScript", language: "js", code: "const kages = await fetch('/api/list_kages').then(r => r.json());" }, { id: "py", label: "Python", language: "py", code: "import requests\nkages = requests.post(url + '/api/list_kages').json()" }] } },
    "a-check": { type: "anchor", props: { name: "check" } },
    "h-check": heading("Check your details"),
    age: { type: "number-input", props: { label: "Your age", min: 0, max: 120, step: 1 }, bind: { value: { $state: "age" }, error: { $if: [{ $lt: [{ $state: "age" }, 18] }, "You must be 18 or older.", ""] } }, on: { change: [{ do: "set", path: "age", value: { $event: "value" } }] } },
    period: { type: "date-range", props: { label: "Reporting period" }, bind: { value: { $state: "period" } }, on: { change: [{ do: "set", path: "period", value: { start: { $event: "start" }, end: { $event: "end" } } }] } },
    report: { type: "file-upload", props: { label: "Attach a CSV (read locally)", accept: ".csv,text/csv,text/plain", maxBytes: 50000 } },
  };
  const media = base("media-gallery", "Media gallery — video, audio and photos");
  media.blocks = {
    root: { type: "page", props: { width: "reading", gap: 6 }, slots: { children: ["intro", "clip", "sound", "photos"] } },
    intro: { type: "section", props: { title: "Show and tell", description: "Passive, captionable media: nothing plays until you press play.", inset: 0 } },
    clip: { type: "video", props: { label: "A flower blooming", src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm", caption: "Time-lapse of a flower (CC0).", transcript: "A flower bud opens slowly over several seconds." } },
    sound: { type: "audio", props: { label: "A dinosaur roar", src: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3", caption: "Sound sample (CC0).", transcript: "A deep, rumbling roar." } },
    photos: { type: "gallery", props: { label: "Colour studies", items: [
      { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAABD0lEQVR42tXCaUcDAADH4d/HKVlSMiVNymSZkpLaTDPLzDKrmYkkkkgiGUkkkUQSSSSRsa51N9u6b9136VWf4/94iDVkSGfVnimdNUeWdNadBulsuLKls+nOkU7ckyudLW+edLZ9+dLZ8RulsxsokM5ea6F09kNF0jkIF0vnsM0knUR7iXSSHaXSSXWWSSfdZZbOUXe5dI57LNI56a2QzmmfVTpn/ZXSOR+oks7FYLV0LiM10rkaqpXO9XCddG5G6qVzO2qTzt2YXTr34w7pPEw0Sudx0imdpymXdJ6n3dJ5mWmSzuusRzpvc17pvM/7pPOx0Cydz0W/dL6WAtL5Xm6Rzs9KUDq/0ZB0/mJh6f+cUAf8Hy6sbAAAAABJRU5ErkJggg==", alt: "Warm orange gradient", caption: "Ember" }, { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAABCUlEQVR42tXCi0ZDAQDH4d+TJCOJJJKYRBJJJJGMSSSRmtb1OI61day1rXWbmdXMzKx7rdvWzMyqtaR36jn+n4+21R3ptHsM6TjWTOl0rFvS6dz0Sadr2y+dbiMgnR7Tlk6vFZROny8knX5/WDoDexHpOO1D6QwGj6QzFDqRznD4TDoj0bh0RmMJ6YwdJ6UzfpqSzkT8QjqTibR0ppIZ6UynstKZOc9JZzadl44rU5COO3spnbnctXTm87fSWSjcS2fx6lE6SzdF6SzfPUtn5eFVOp5iSTrep3fpbLxUpLP1VpWOUa5Jx6zUpWNVG9LZrX1IJ1D/ko7d+JbO/uePdA6av9KJtv6k/wM3+M3PnpzlbQAAAABJRU5ErkJggg==", alt: "Cool teal gradient", caption: "Lagoon" },
      { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAABBklEQVR42tXCDUcDAQDH4f9nSiQSiZmVmV60NTOVKTNrzTnOWrO21rRWW6s5qzlrzXISySSSGUkiSfR1+hy/x6OxpAdd4ykvuibSPnRNGvPomjL96Jq2AuiaySygaza7hC5PbgVd3v0QuuaKYXT5SxF0BcpRdC1W1tC1XN1AV/A0hq7V+ha6Io04uqLNBLrW7SS6Yq0Uujav0uiKOwa6Eh0TXdtdC107vQy6jNssukw3hy7rLo+u3fsCuvYeDtCVfzxEV2FwhK7S0zG6ys8n6Kq81NBVfT1DV214jq7GqImuizcbXfb7JbpaH210tT8ddDlfHXRdf3fRdfPTQ1f/t48u989F/wdpg1XPpvn/wAAAAABJRU5ErkJggg==", alt: "Soft green gradient", caption: "Meadow" }, { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAABCElEQVR42tXCi0ZDAQDH4d+DJUmSmCSTLmZmZqqZmZnpYmZmpouZ7ThOzWmtmllm3WealElJSUmaKZM9R8/x/3wUhualYwwvSscccUnHGnVLZ3fMI53iuFc69oRPOvuTfukcOJalczgVkM7xdFA6lZmQdKrOsHRqsxHpnMxFpVNfiEmn4VqTzql7Qzrnnrh0Lr0J6Vz7ktJp+lPSaS2lpXOzkpFOO7glndvQjnTuwlnp3Edy0ulE89J5iBnSeVw1pfO0bknnOV6UzkvCls5rsiSdt1RZOu/pI+l8ZCrS+dysSudruyad72xdOt1cQzq9/Jl0fowL6fyaV9LpW03p/O21pDOw29L/Ad++j+3HCrdzAAAAAElFTkSuQmCC", alt: "Rose gradient", caption: "Dusk" }] } },
  };
  // A long evidence-backed brief: contents rail, numbered citations, a captioned
  // figure, an attributed quote, a self-check that keeps its ticks, a glossary
  // and a sources list. The shape the `research-briefs` skill teaches.
  const brief = base("research-brief", "Trunk-based development — a research brief");
  brief.state = { c1: false, c2: false, c3: false, c4: false };
  brief.persist = { c1: "personal", c2: "personal", c3: "personal", c4: "personal" };
  const cite = (n: number, id: string) => ({ text: String(n), cite: id });
  const lane = (y: number, label: string) => [{ kind: "text", x: 12, y: y + 4, text: label, size: 12, fill: "ink-muted" }];
  const ticks = { $add: ["c1", "c2", "c3", "c4"].map((k) => ({ $if: [{ $state: k }, 1, 0] })) } as unknown as Expr;
  const check = (id: string, label: string) => ({ type: "checkbox", props: { label }, bind: { checked: { $state: id } }, on: { change: [{ do: "set", path: id, value: { $event: "checked" } }] } });
  brief.blocks = {
    root: { type: "page", props: { width: "wide", gap: 8 }, slots: { children: ["hero", "figures", "layout"] } },
    hero: { type: "section", props: { eyebrow: "Source control · research brief · October 2026", title: "Trunk-based development", description: "Everyone integrates small changes into one shared branch at least once a day. DORA ties the habit to faster, more stable delivery.", inset: 0 } },
    figures: { type: "grid", props: { columns: 3, minSize: "small", gap: 4 }, slots: { children: ["f1", "f2", "f3"] } },
    f1: { type: "stat", props: { label: "Active branches, trunk included", value: "3 or fewer", caption: "DORA threshold" } },
    f2: { type: "stat", props: { label: "Merges per developer", value: "1+ a day", caption: "DORA threshold" } },
    f3: { type: "stat", props: { label: "Code freezes", value: "None", caption: "DORA threshold" } },
    layout: { type: "split", props: { ratio: "wide-end", gap: 8 }, slots: { start: ["toc"], end: ["a-what", "what", "quote", "fig", "a-check", "h-check", "checks", "score", "verdict", "a-code", "h-code", "snippet", "a-terms", "terms", "a-sources", "sources"] } },
    toc: { type: "toc", props: { title: "Contents", sticky: true, items: [{ label: "What it is", target: "what" }, { label: "Self-check", target: "check" }, { label: "In code", target: "code" }, { label: "Glossary", target: "terms" }, { label: "Sources", target: "sources" }] } },
    "a-what": { type: "anchor", props: { name: "what" } },
    what: { type: "rich-text", props: { nodes: [
      { kind: "heading", level: 2, text: "What it is" },
      { kind: "paragraph", runs: [{ text: "Developers collaborate on one branch called trunk and resist long-lived development branches" }, cite(1, "tbd"), { text: ". DORA puts it in operational terms: small batches merged at least once a day" }, cite(2, "dora"), { text: "." }] },
    ] } },
    quote: { type: "rich-text", props: { nodes: [{ kind: "quote", text: "If it hurts, do it more often.", attribution: "Martin Fowler on integration frequency", href: "https://martinfowler.com/articles/branching-patterns.html" }] } },
    fig: { type: "scene", props: { label: "Trunk with short-lived branches and one release branch", caption: "Branches rejoin within a day; the release branch is cut late and only receives cherry-picks.", width: 640, height: 200, shapes: [
      ...lane(60, "trunk"),
      { kind: "line", x: 60, y: 60, x2: 620, y2: 60, stroke: "accent", strokeWidth: 4 },
      { kind: "path", d: "M140 60 Q150 20 175 20 L215 20 Q240 20 250 60", stroke: "ink-muted", strokeWidth: 2 },
      { kind: "path", d: "M330 60 Q340 20 365 20 L405 20 Q430 20 440 60", stroke: "ink-muted", strokeWidth: 2 },
      ...lane(150, "release"),
      { kind: "path", d: "M470 60 Q485 150 520 150 L620 150", stroke: "ink", strokeWidth: 2 },
      { kind: "circle", x: 140, y: 60, radius: 5, fill: "paper", stroke: "accent", strokeWidth: 2 },
      { kind: "circle", x: 250, y: 60, radius: 5, fill: "paper", stroke: "accent", strokeWidth: 2 },
      { kind: "circle", x: 440, y: 60, radius: 5, fill: "paper", stroke: "accent", strokeWidth: 2 },
    ] } },
    "a-check": { type: "anchor", props: { name: "check" } },
    "h-check": { type: "rich-text", props: { nodes: [{ kind: "heading", level: 2, text: "Self-check" }, { kind: "paragraph", text: "Tick what is true for your team today. Your ticks stay in this browser." }] } },
    checks: { type: "stack", props: { gap: 2 }, slots: { children: ["k1", "k2", "k3", "k4"] } },
    k1: check("c1", "Three or fewer active branches"),
    k2: check("c2", "Every developer merges to trunk daily"),
    k3: check("c3", "No code freezes"),
    k4: check("c4", "Unfinished features ship behind flags"),
    score: { type: "stat", props: { label: "Your score out of 4" }, bind: { value: ticks } },
    verdict: { type: "text", props: { variant: "muted" }, bind: { text: { $if: [{ $gte: [ticks, 4] }, "All four hold. You are practising trunk-based development.", "Tick what is true. Fewer than four means there is room to move toward trunk."] } } },
    "a-code": { type: "anchor", props: { name: "code" } },
    "h-code": { type: "rich-text", props: { nodes: [{ kind: "heading", level: 2, text: "In code" }, { kind: "paragraph", text: "A release flag chooses the implementation while both ship on trunk." }] } },
    snippet: { type: "code", props: { language: "ts", caption: "Branch by abstraction behind a flag", code: "// Commit 1: the abstraction. Behaviour unchanged.\ninterface PaymentGateway { charge(order: Order): Promise<Receipt>; }\n\nfunction gatewayFor(user: User): PaymentGateway {\n  return flags.isEnabled(\"payments.new-gateway\", { userId: user.id })\n    ? new NewGateway()\n    : new LegacyGateway();\n}" } },
    "a-terms": { type: "anchor", props: { name: "terms" } },
    terms: { type: "glossary", props: { title: "Glossary", items: [
      { term: "Trunk", definition: "The single shared branch, also called main or master. It should always be releasable." },
      { term: "Feature flag", definition: "A runtime switch that turns a code path on or off, separating deployment from release." },
      { term: "Cherry-pick", definition: "Copying one commit from trunk to a release branch." },
    ] } },
    "a-sources": { type: "anchor", props: { name: "sources" } },
    sources: { type: "references", props: { title: "Sources", items: [
      { id: "tbd", label: "Trunk Based Development", href: "https://trunkbaseddevelopment.com/", detail: "Paul Hammant et al." },
      { id: "dora", label: "Capabilities: Trunk-based development", href: "https://dora.dev/capabilities/trunk-based-development/", detail: "DORA" },
    ] } },
  };
  return declared([docs, media, brief, ...useCaseExamples(system), ...showcaseExamples(system), ...guideExamples(system), ...polishExamples(system)]);
}
