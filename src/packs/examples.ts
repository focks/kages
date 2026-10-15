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
  return [board, flow];
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
    root: { type: "page", props: { width: "reading", gap: 6 }, slots: { children: ["body", "formula", "slides"] } },
    body: { type: "markdown", props: { text: "## Why compounding wins\n\nA balance grows by a factor of **(1 + r)** each year, so after *n* years it is $P(1+r)^n$. Read more at [the docs](https://example.com/docs).\n\n- Start early\n- Be consistent\n\n> Time in the market beats timing the market.\n\n```\nbalance = principal * (1 + rate) ** years\n```" } },
    formula: { type: "math", props: { display: true, label: "Compound growth", tex: "A = P\\left(1 + \\frac{r}{n}\\right)^{nt}" } },
    slides: { type: "carousel", props: { label: "Three habits", slides: [{ title: "Automate", text: "Pay yourself first." }, { title: "Diversify", text: "Spread the risk." }, { title: "Wait", text: "Let time do the work." }] } },
  };
  return [bench, read];
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
  return [explorer, feed, rules];
}
