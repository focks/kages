// One complete example per everyday use case people ask an agent to build: a quiz, flashcards, an architecture
// explainer, a small game, a pricing proposal, a trip plan, a runbook, meeting notes and a portfolio. Each is a whole
// document, not a snippet, so an agent reads a working composition and a person gets a starting point they can open.
// They run through the same checks as every shipped example: valid, lint-clean, rendered in all three systems.
import type { KageDoc, Expr, Mode } from "../engine/types.ts";

/** What the visitor is trying to do in each example; the mode facet, mode-gated lint and critique read this. */
export const USE_CASE_MODES: Record<string, Mode> = {
  "study-quiz": "experience", flashcards: "experience", "architecture-explainer": "read", "tic-tac-toe": "experience",
  "pricing-proposal": "persuade", "trip-itinerary": "read", "incident-runbook": "operate", "meeting-notes": "read", "project-portfolio": "persuade",
};

const S = (key: string): Expr => ({ $state: key });
const set = (path: string, value: unknown) => ({ do: "set", path, value }) as never;
const sum = (...parts: unknown[]): Expr => ({ $add: parts }) as never;
const when = (cond: unknown, yes: unknown, no: unknown): Expr => ({ $if: [cond, yes, no] }) as never;
const eq = (a: unknown, b: unknown): Expr => ({ $eq: [a, b] }) as never;
const bindValue = (key: string) => ({ bind: { value: S(key) }, on: { change: [set(key, { $event: "value" })] } });
const bindChecked = (key: string) => ({ bind: { checked: S(key) }, on: { change: [set(key, { $event: "checked" })] } });

export function useCaseExamples(system = "core"): KageDoc[] {
  const base = (id: string, title: string): KageDoc => ({ kages: "1.0", id, title, system: system + "@" + (system === "ledger" ? "2" : "1"), root: "root", blocks: {} });
  return [quiz(base("study-quiz", "Quiz — how photosynthesis works")), flashcards(base("flashcards", "Flashcards — the parts of a cell")),
    architecture(base("architecture-explainer", "Architecture explainer — a web service, piece by piece")), game(base("tic-tac-toe", "Tic-tac-toe — a two-player game")),
    pricing(base("pricing-proposal", "Pricing proposal — plans, seats and a live estimate")), trip(base("trip-itinerary", "Trip itinerary — three days in Lisbon")),
    runbook(base("incident-runbook", "Incident runbook — from alert to resolution")), meeting(base("meeting-notes", "Meeting notes — decisions and action items")),
    portfolio(base("project-portfolio", "Project portfolio — selected work and a contact form"))];
}

// ---------------------------------------------------------------- learning

function quiz(doc: KageDoc): KageDoc {
  const questions = [
    { text: "Where in a plant cell does photosynthesis take place?", options: ["Chloroplast", "Mitochondrion", "Nucleus"], answer: "Chloroplast", why: "Chloroplasts hold the chlorophyll that captures light." },
    { text: "Which gas do plants take in for photosynthesis?", options: ["Oxygen", "Carbon dioxide", "Nitrogen"], answer: "Carbon dioxide", why: "Carbon from carbon dioxide is built into sugar." },
    { text: "What do plants make using the energy of light?", options: ["Protein", "Wax", "Glucose"], answer: "Glucose", why: "Glucose is the sugar the plant uses for energy and growth." },
  ];
  const keys = questions.map((_, i) => "q" + (i + 1));
  doc.state = { ...Object.fromEntries(keys.map((k) => [k, ""])), submitted: false };
  const right = (i: number): Expr => eq(S(keys[i]), questions[i].answer);
  const blocks: KageDoc["blocks"] = {
    root: { type: "page", props: { width: "reading", gap: 6 }, slots: { children: ["intro", ...keys.map((k) => "card-" + k), "actions", "result"] } },
    intro: { type: "section", props: { eyebrow: "Biology", title: "How photosynthesis works", description: "Three questions. Answer them all, then check your work: each answer comes with a one-line reason.", inset: 0 } },
    actions: { type: "stack", props: { direction: "row", gap: 3, wrap: true }, slots: { children: ["check", "again"] } },
    check: { type: "button", props: { label: "Check my answers", variant: "primary" }, bind: { disabled: { $or: keys.map((k) => eq(S(k), "")) } as never }, on: { click: [set("submitted", true)] } },
    again: { type: "button", props: { label: "Start over", variant: "secondary" }, on: { click: [...keys.map((k) => set(k, "")), set("submitted", false)] } },
    result: { type: "alert", props: { tone: "info", title: "Your result" }, bind: { text: { $concat: ["You got ", sum(...keys.map((_, i) => when(right(i), 1, 0))), " of ", questions.length, " right."] } }, visible: S("submitted") },
  };
  questions.forEach((q, i) => {
    const k = keys[i];
    blocks["card-" + k] = { type: "card", props: { title: `Question ${i + 1}` }, slots: { children: [k, `${k}-ok`, `${k}-no`] } };
    blocks[k] = { type: "choice", props: { label: q.text, name: k, options: q.options.map((o) => ({ value: o, label: o })) }, ...bindValue(k), bind: { value: S(k), disabled: S("submitted") } };
    blocks[`${k}-ok`] = { type: "alert", props: { tone: "success", title: "Correct", text: q.why }, visible: { $and: [S("submitted"), right(i)] } };
    blocks[`${k}-no`] = { type: "alert", props: { tone: "warning", title: "Not quite", text: `The answer is ${q.answer}. ${q.why}` }, visible: { $and: [S("submitted"), { $not: right(i) }] } };
  });
  doc.blocks = blocks;
  return doc;
}

function flashcards(doc: KageDoc): KageDoc {
  doc.data = { cards: [
    { id: "nucleus", term: "Nucleus", definition: "Holds the cell's DNA and directs its activity." },
    { id: "mito", term: "Mitochondrion", definition: "Releases usable energy from food molecules." },
    { id: "ribosome", term: "Ribosome", definition: "Builds proteins from instructions copied from DNA." },
    { id: "membrane", term: "Cell membrane", definition: "A thin boundary that controls what enters and leaves." },
    { id: "golgi", term: "Golgi apparatus", definition: "Sorts, packages and ships proteins to where they are needed." },
    { id: "chloroplast", term: "Chloroplast", definition: "Captures light to make sugar in plant cells." },
  ] };
  doc.state = { query: "" };
  const visible = { $filter: { list: { $data: "cards" }, fields: ["term", "definition"], contains: S("query") } };
  doc.blocks = {
    root: { type: "page", props: { width: "wide", gap: 6 }, slots: { children: ["intro", "search", "deck", "none"] } },
    intro: { type: "section", props: { eyebrow: "Study", title: "The parts of a cell", description: "Read the term, say what it does, then open the card to check yourself.", inset: 0 } },
    search: { type: "text-field", props: { label: "Find a card", placeholder: "Try energy" }, ...bindValue("query") },
    deck: { type: "grid", props: { columns: 3, minSize: "small", gap: 4 }, slots: { children: ["card"] } },
    card: { type: "card", props: {}, bind: { title: { $item: "term" } }, repeat: { each: { $sort: { list: visible, field: "term" } } as never, key: "id", as: "card" }, slots: { children: ["answer"] } },
    answer: { type: "accordion", props: {}, bind: { items: [{ id: "a", title: "Show the answer", body: { $item: "definition" } }] as never } },
    none: { type: "text", props: { text: "No card matches. Try a different word.", variant: "muted" }, visible: eq({ $count: visible }, 0) },
  };
  return doc;
}

// ---------------------------------------------------------------- explanation

function architecture(doc: KageDoc): KageDoc {
  doc.state = { picked: "api" };
  doc.data = { parts: [
    { id: "browser", name: "Browser", role: "Shows the page and sends requests.", talksTo: "CDN, API" },
    { id: "cdn", name: "CDN", role: "Serves static files from a location near the visitor.", talksTo: "Browser" },
    { id: "api", name: "API", role: "Checks the request, applies the rules and answers with data.", talksTo: "Cache, Database, Queue" },
    { id: "cache", name: "Cache", role: "Keeps recent answers in memory so repeat requests are fast.", talksTo: "API" },
    { id: "db", name: "Database", role: "Stores the records that must not be lost.", talksTo: "API" },
    { id: "queue", name: "Queue", role: "Holds slow jobs, such as emails, until a worker takes them.", talksTo: "API, Worker" },
    { id: "worker", name: "Worker", role: "Does the slow jobs in the background.", talksTo: "Queue, Database" },
  ] };
  const picked = { $filter: { list: { $data: "parts" }, field: "id", equals: S("picked") } };
  doc.blocks = {
    root: { type: "page", props: { width: "wide", gap: 6 }, slots: { children: ["intro", "layout"] } },
    intro: { type: "section", props: { eyebrow: "Systems", title: "A web service, piece by piece", description: "Select a part of the diagram to see what it does and what it talks to.", inset: 0 } },
    layout: { type: "split", props: { ratio: "wide-start", gap: 6 }, slots: { start: ["map"], end: ["detail"] } },
    map: { type: "diagram", props: { label: "How a request flows through the parts of a web service", caption: "Arrows show who calls whom. The selected part is described beside the diagram.", interactive: true,
      nodes: [{ id: "browser", label: "Browser", x: 20, y: 30 }, { id: "cdn", label: "CDN", x: 260, y: 30 }, { id: "api", label: "API", x: 20, y: 170 }, { id: "cache", label: "Cache", x: 260, y: 170 },
        { id: "db", label: "Database", x: 20, y: 310 }, { id: "queue", label: "Queue", x: 260, y: 310 }, { id: "worker", label: "Worker", x: 20, y: 450 }],
      edges: [{ from: "browser", to: "cdn" }, { from: "browser", to: "api" }, { from: "api", to: "cache" }, { from: "api", to: "db" }, { from: "api", to: "queue" }, { from: "queue", to: "worker" }] },
      on: { select: [set("picked", { $event: "id" })] } },
    detail: { type: "card", props: { title: "About this part" }, slots: { children: ["part"] } },
    part: { type: "text", props: { variant: "body" }, bind: { text: { $tpl: "Select a part of the diagram." } }, visible: eq({ $count: picked }, 0), slots: {} },
    "part-row": { type: "section", props: { level: 3, inset: 0 }, bind: { title: { $item: "name" } }, repeat: { each: picked as never, key: "id", as: "part" }, slots: { children: ["part-role", "part-links"] } },
    "part-role": { type: "text", props: { variant: "body" }, bind: { text: { $item: "role" } } },
    "part-links": { type: "text", props: { variant: "muted" }, bind: { text: { $concat: ["Talks to: ", { $item: "talksTo" }] } } },
  };
  (doc.blocks.detail.slots as Record<string, string[]>).children = ["part", "part-row"];
  return doc;
}

// ---------------------------------------------------------------- play

function game(doc: KageDoc): KageDoc {
  const cells = Array.from({ length: 9 }, (_, i) => "c" + i);
  doc.state = { ...Object.fromEntries(cells.map((c) => [c, ""])), turn: "X" };
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const won: Expr = { $or: lines.map(([a, b, c]) => ({ $and: [{ $neq: [S(cells[a]), ""] }, eq(S(cells[a]), S(cells[b])), eq(S(cells[b]), S(cells[c]))] })) } as never;
  const full: Expr = { $and: cells.map((c) => ({ $neq: [S(c), ""] })) } as never;
  const mover = when(eq(S("turn"), "X"), "O", "X"); // the turn has already passed to the other player when someone wins
  // The board is one interactive drawing: nine squares you can press (keyboard too) and a large mark in each taken one.
  const SIZE = 120, shapes = cells.flatMap((c, i) => {
    const x = (i % 3) * SIZE, y = Math.floor(i / 3) * SIZE;
    return [
      { kind: "rect", id: c, x: x + 4, y: y + 4, width: SIZE - 8, height: SIZE - 8, radius: 10, fill: "surface", stroke: "line", strokeWidth: 2, label: `Square ${i + 1}` },
      { kind: "text", x: x + 38, y: y + 82, size: 64, text: S(c), fill: when(eq(S(c), "X"), "ink", "accent") },
    ];
  });
  // Pass the turn first, then write the mark of the player who just moved: both steps share one guard, which stays true
  // between them because neither changes whether the square is empty or the game is won.
  const guard = { $and: [{ $or: cells.map((c) => ({ $and: [eq({ $event: "id" }, c), eq(S(c), "")] })) }, { $not: won }] };
  doc.blocks = {
    root: { type: "page", props: { width: "wide", gap: 6 }, slots: { children: ["intro", "play"] } },
    play: { type: "split", props: { ratio: "equal", gap: 8 }, slots: { start: ["board"], end: ["side"] } },
    side: { type: "stack", props: { gap: 4 }, slots: { children: ["status", "reset"] } },
    intro: { type: "section", props: { eyebrow: "Game", title: "Tic-tac-toe", description: "Two players share the screen. Take turns; three in a row wins.", inset: 0 } },
    board: { type: "scene", props: { label: "Tic-tac-toe board", width: SIZE * 3, height: SIZE * 3, interactive: true, shapes: [] }, bind: { shapes: shapes as never },
      on: { select: [{ do: "set", path: "turn", value: mover, when: guard }, { do: "set", path: { $event: "id" }, value: mover, when: guard }] as never } },
    status: { type: "alert", props: { tone: "info", title: "Game status" }, bind: { text: when(won, { $concat: [mover, " wins!"] }, when(full, "It is a draw.", { $concat: ["Next move: ", S("turn")] })) } },
    reset: { type: "button", props: { label: "New game", variant: "secondary" }, on: { click: [...cells.map((c) => set(c, "")), set("turn", "X")] } },
  };
  return doc;
}

// ---------------------------------------------------------------- persuade and decide

function pricing(doc: KageDoc): KageDoc {
  doc.state = { annual: false, seats: 5, plan: "team", interest: false };
  doc.data = { plans: [
    { id: "starter", name: "Starter", perSeat: 8, summary: "For one small group getting started.", limit: 3 },
    { id: "team", name: "Team", perSeat: 15, summary: "For teams that share work every day.", limit: 25 },
    { id: "business", name: "Business", perSeat: 29, summary: "For several teams that need review and control.", limit: 200 },
  ] };
  const price = (per: Expr): Expr => when(S("annual"), { $mul: [per, 10] }, per) as never; // illustrative: two months free when billed yearly
  const per = (): Expr => ({ $item: "perSeat" }) as never;
  const perChosen: Expr = { $sum: [{ $filter: { list: { $data: "plans" }, field: "id", equals: S("plan") } }, "perSeat"] } as never;
  doc.blocks = {
    root: { type: "page", props: { width: "wide", gap: 8 }, slots: { children: ["hero", "controls", "plans", "estimate", "faq", "ask"] } },
    hero: { type: "section", props: { eyebrow: "Proposal", title: "Plans that grow with the team", description: "Pick a plan, set the number of seats and see the cost. All prices on this page are illustrative.", inset: 0 } },
    controls: { type: "stack", props: { direction: "row", gap: 6, wrap: true, align: "center" }, slots: { children: ["billing", "seats"] } },
    billing: { type: "switch", props: { label: "Bill yearly (ten months for twelve)" }, ...bindChecked("annual") },
    seats: { type: "slider", props: { label: "Seats", min: 1, max: 100, step: 1 }, ...bindValue("seats") },
    plans: { type: "grid", props: { columns: 3, minSize: "medium", gap: 4 }, slots: { children: ["plan"] } },
    plan: { type: "card", props: {}, bind: { title: { $item: "name" }, subtitle: { $item: "summary" } }, repeat: { each: { $data: "plans" }, key: "id", as: "plan" }, slots: { children: ["plan-price", "plan-limit", "plan-pick"] } },
    "plan-price": { type: "text", props: { variant: "title" }, bind: { text: { $concat: [{ $format: { value: price(per()), style: "currency", digits: 0 } }, when(S("annual"), " per seat a year", " per seat a month")] } } },
    "plan-limit": { type: "text", props: { variant: "muted" }, bind: { text: { $concat: ["Up to ", { $item: "limit" }, " seats"] } } },
    "plan-pick": { type: "button", props: { label: "Choose this plan", variant: "secondary" }, on: { click: [set("plan", { $item: "id" })] } },
    estimate: { type: "stat", props: { label: "Estimated cost", caption: "For the chosen plan and seats; illustrative." },
      bind: { value: { $format: { value: { $mul: [price(perChosen), S("seats")] }, style: "currency", digits: 0 } }, caption: { $concat: ["Plan: ", S("plan"), ", ", S("seats"), " seats, billed ", when(S("annual"), "yearly", "monthly"), ". Illustrative."] } } },
    faq: { type: "accordion", props: { items: [
      { id: "change", title: "Can I change plan later?", body: "Yes. Pick another plan at any time; the estimate above updates to show the difference." },
      { id: "seats", title: "What counts as a seat?", body: "One person who signs in. People who only read shared pages do not need a seat." },
      { id: "yearly", title: "How does yearly billing work?", body: "You pay for ten months and use twelve. The calculator applies this when you switch it on." },
    ] } },
    ask: { type: "button", props: { label: "Ask for this plan", variant: "primary" }, on: { click: [set("interest", true)] } },
  };
  (doc.blocks.root.slots as Record<string, string[]>).children.push("thanks");
  doc.blocks.thanks = { type: "alert", props: { tone: "success", title: "Request noted" }, bind: { text: { $concat: ["We will follow up about the ", S("plan"), " plan for ", S("seats"), " seats."] } }, visible: S("interest") };
  return doc;
}

// ---------------------------------------------------------------- plan and operate

function trip(doc: KageDoc): KageDoc {
  doc.state = { p1: false, p2: false, p3: false, p4: false, p5: false, tab: "d1" };
  doc.persist = { p1: "personal", p2: "personal", p3: "personal", p4: "personal", p5: "personal" };
  doc.data = { budget: [{ label: "Stay", value: 360 }, { label: "Food", value: 210 }, { label: "Getting around", value: 70 }, { label: "Sights", value: 95 }] };
  const day = (items: Array<[string, string, string]>) => ({ label: "Plan", items: items.map(([time, title, description]) => ({ time, title, description })) });
  const days = [
    day([["09:00", "Alfama on foot", "Wander the old streets before the crowds arrive."], ["13:00", "Lunch near the river", "Grilled fish and a short rest."], ["16:00", "Castle viewpoint", "Walk up for the late light over the city."]]),
    day([["10:00", "Belém", "The tower, the monastery and a custard tart."], ["14:00", "Museum of art and technology", "A building you can walk across."], ["19:00", "Fado evening", "Book a small room; arrive early for a seat."]]),
    day([["09:30", "Tram 28 to the hills", "Ride early, then walk back downhill."], ["12:30", "Market lunch", "Plenty of stalls under one roof."], ["17:00", "Sunset by the water", "Pack up slowly and enjoy the last evening."]]),
  ];
  const packed = sum(...["p1", "p2", "p3", "p4", "p5"].map((k) => when(S(k), 1, 0)));
  doc.blocks = {
    root: { type: "page", props: { width: "wide", gap: 6 }, slots: { children: ["hero", "days", "split"] } },
    hero: { type: "section", props: { eyebrow: "Itinerary", title: "Three days in Lisbon", description: "A relaxed plan: one area a day, long lunches and the sights worth the walk.", inset: 0 } },
    days: { type: "tab-panel", props: { label: "Day", tabs: [{ id: "d1", label: "Day 1 · Old town" }, { id: "d2", label: "Day 2 · Belém" }, { id: "d3", label: "Day 3 · Hills" }] }, bind: { value: S("tab") }, on: { change: [set("tab", { $event: "id" })] }, slots: { panel1: ["t1"], panel2: ["t2"], panel3: ["t3"] } },
    t1: { type: "timeline", props: { label: "Day 1", items: days[0].items } },
    t2: { type: "timeline", props: { label: "Day 2", items: days[1].items } },
    t3: { type: "timeline", props: { label: "Day 3", items: days[2].items } },
    split: { type: "split", props: { ratio: "equal", gap: 6 }, slots: { start: ["budget"], end: ["packing"] } },
    budget: { type: "bar-chart", props: { label: "Budget by category (euros)", format: "currency" }, bind: { items: { $data: "budget" } } },
    packing: { type: "stack", props: { gap: 3 }, slots: { children: ["packing-title", "p1", "p2", "p3", "p4", "p5", "progress"] } },
    "packing-title": { type: "text", props: { text: "Packing list", variant: "heading" } },
    p1: { type: "checkbox", props: { label: "Passport or ID card" }, ...bindChecked("p1") },
    p2: { type: "checkbox", props: { label: "Phone charger and adapter" }, ...bindChecked("p2") },
    p3: { type: "checkbox", props: { label: "Comfortable walking shoes" }, ...bindChecked("p3") },
    p4: { type: "checkbox", props: { label: "Light rain jacket" }, ...bindChecked("p4") },
    p5: { type: "checkbox", props: { label: "Printed booking confirmations" }, ...bindChecked("p5") },
    progress: { type: "gauge", props: { label: "Packed", min: 0, max: 5, unit: " of 5" }, bind: { value: packed } },
  };
  return doc;
}

function runbook(doc: KageDoc): KageDoc {
  const steps = [
    { id: "detect", label: "Detect", description: "Confirm the alert is real." },
    { id: "triage", label: "Triage", description: "Set severity and find the owner." },
    { id: "mitigate", label: "Mitigate", description: "Stop the damage first." },
    { id: "resolve", label: "Resolve", description: "Fix the cause and verify." },
    { id: "review", label: "Review", description: "Write down what was learned." },
  ];
  doc.state = { severity: "sev2", step: "detect", paged: false, statusPosted: false };
  const stepIs = (id: string): Expr => eq(S("step"), id);
  doc.blocks = {
    root: { type: "page", props: { width: "wide", gap: 6 }, slots: { children: ["intro", "severity", "guide-sev1", "guide-sev2", "guide-sev3", "progress", "detect", "triage", "mitigate", "resolve", "review"] } },
    intro: { type: "section", props: { eyebrow: "Operations", title: "Incident runbook", description: "Work through the steps in order. Set the severity first: it decides who is paged and how often to update.", inset: 0 } },
    severity: { type: "choice", props: { label: "Severity", name: "severity", options: [{ value: "sev1", label: "Sev 1 · service down" }, { value: "sev2", label: "Sev 2 · major feature degraded" }, { value: "sev3", label: "Sev 3 · minor issue" }] }, ...bindValue("severity") },
    "guide-sev1": { type: "alert", props: { tone: "danger", title: "Sev 1", text: "Page the on-call engineer and the incident lead now. Post a status update every 15 minutes." }, visible: eq(S("severity"), "sev1") },
    "guide-sev2": { type: "alert", props: { tone: "warning", title: "Sev 2", text: "Page the on-call engineer. Post a status update every 30 minutes." }, visible: eq(S("severity"), "sev2") },
    "guide-sev3": { type: "alert", props: { tone: "info", title: "Sev 3", text: "Open a ticket for the owning team. A status update is not needed." }, visible: eq(S("severity"), "sev3") },
    progress: { type: "stepper", props: { label: "Incident progress", steps, interactive: true }, ...bindValue("step") },
    detect: { type: "section", props: { level: 3, title: "Detect", description: "Check the alert against a second signal before waking anyone.", inset: 0 }, visible: stepIs("detect"), slots: { children: ["detect-code", "detect-next"] } },
    "detect-code": { type: "code-tabs", props: { caption: "Quick checks", tabs: [{ id: "health", label: "Health", language: "sh", code: "curl -fsS https://status.example.com/health || echo \"health check failed\"" }, { id: "logs", label: "Logs", language: "sh", code: "kubectl logs deploy/api --since=10m | grep -i error | tail -n 20" }] } },
    "detect-next": { type: "button", props: { label: "It is real: go to triage", variant: "primary" }, on: { click: [set("step", "triage")] } },
    triage: { type: "section", props: { level: 3, title: "Triage", description: "Page the owner, then open the incident channel.", inset: 0 }, visible: stepIs("triage"), slots: { children: ["page-owner", "triage-next"] } },
    "page-owner": { type: "checkbox", props: { label: "The owning team is paged" }, ...bindChecked("paged") },
    "triage-next": { type: "button", props: { label: "Owner paged: go to mitigation", variant: "primary", disabled: false }, bind: { disabled: { $not: S("paged") } as never }, on: { click: [set("step", "mitigate")] } },
    mitigate: { type: "section", props: { level: 3, title: "Mitigate", description: "Prefer the fastest safe action: roll back, turn a flag off or shift traffic.", inset: 0 }, visible: stepIs("mitigate"), slots: { children: ["mitigate-code", "status-posted", "mitigate-next"] } },
    "mitigate-code": { type: "code-tabs", props: { caption: "Common mitigations", tabs: [{ id: "rollback", label: "Roll back", language: "sh", code: "kubectl rollout undo deploy/api\nkubectl rollout status deploy/api" }, { id: "flag", label: "Turn a flag off", language: "sh", code: "flagctl set checkout.new-flow off --env production" }] } },
    "status-posted": { type: "checkbox", props: { label: "A status update is posted" }, ...bindChecked("statusPosted") },
    "mitigate-next": { type: "button", props: { label: "Impact stopped: go to resolution", variant: "primary" }, bind: { disabled: { $not: S("statusPosted") } as never }, on: { click: [set("step", "resolve")] } },
    resolve: { type: "section", props: { level: 3, title: "Resolve", description: "Fix the cause, watch the graphs return to normal and close the alert.", inset: 0 }, visible: stepIs("resolve"), slots: { children: ["resolve-next"] } },
    "resolve-next": { type: "button", props: { label: "Resolved: go to review", variant: "primary" }, on: { click: [set("step", "review")] } },
    review: { type: "section", props: { level: 3, title: "Review", description: "Within two working days, write what happened, what helped and what to change. Keep it about the system, not a person.", inset: 0 }, visible: stepIs("review"), slots: { children: ["restart"] } },
    restart: { type: "button", props: { label: "Start a new incident", variant: "secondary" }, on: { click: [set("step", "detect"), set("paged", false), set("statusPosted", false)] } },
  };
  return doc;
}

// ---------------------------------------------------------------- document and show

function meeting(doc: KageDoc): KageDoc {
  doc.state = { owner: "all" };
  doc.data = { actions: [
    { id: "a1", task: "Draft the launch checklist", owner: "Maya", due: "2026-11-02", status: "Open" },
    { id: "a2", task: "Confirm the venue and catering", owner: "Jonas", due: "2026-11-04", status: "Open" },
    { id: "a3", task: "Send the invitation list for review", owner: "Maya", due: "2026-10-28", status: "Done" },
    { id: "a4", task: "Update the budget with the new quote", owner: "Priya", due: "2026-11-06", status: "Open" },
  ] };
  const shown = { $filter: { list: { $data: "actions" }, field: "owner", equals: S("owner"), skipIf: "all" } };
  doc.blocks = {
    root: { type: "page", props: { width: "reading", gap: 6 }, slots: { children: ["intro", "agenda", "decisions", "owner", "summary", "actions"] } },
    intro: { type: "section", props: { eyebrow: "Meeting notes · 21 October 2026", title: "Launch planning", description: "Attendees: Maya, Jonas and Priya. Purpose: agree the plan and who does what.", inset: 0 } },
    agenda: { type: "rich-text", props: { nodes: [{ kind: "heading", level: 2, text: "Agenda" }, { kind: "list", ordered: true, items: ["Where the launch stands", "Venue and catering", "Budget", "Who does what next"] }] } },
    decisions: { type: "rich-text", props: { nodes: [{ kind: "heading", level: 2, text: "Decisions" }, { kind: "list", items: ["Launch on the planned date; no change to the schedule.", "Use the smaller venue and spend the difference on catering.", "Review the budget again once the new quote arrives."] }] } },
    owner: { type: "dropdown", props: { label: "Show action items for", options: [{ value: "all", label: "Everyone" }, { value: "Maya", label: "Maya" }, { value: "Jonas", label: "Jonas" }, { value: "Priya", label: "Priya" }] }, ...bindValue("owner") },
    summary: { type: "text", props: { variant: "muted" }, bind: { text: { $concat: [{ $count: shown }, " action items shown"] } } },
    actions: { type: "table", props: { columns: [{ key: "task", label: "Action" }, { key: "owner", label: "Owner" }, { key: "due", label: "Due" }, { key: "status", label: "Status" }] }, bind: { rows: { $sort: { list: shown, field: "due" } } as never } },
  };
  return doc;
}

function portfolio(doc: KageDoc): KageDoc {
  doc.state = { kind: "all", sent: null };
  doc.data = { projects: [
    { id: "p1", name: "Harbour Notes", kind: "Product", summary: "A note-taking app for people who work on boats and at docks.", year: 2025 },
    { id: "p2", name: "Seed to Shelf", kind: "Brand", summary: "A visual identity and packaging for a small regional grower.", year: 2024 },
    { id: "p3", name: "Transit Atlas", kind: "Research", summary: "A study of how people choose between bus, bike and walking.", year: 2024 },
    { id: "p4", name: "Open Studio Days", kind: "Product", summary: "A booking page for neighbourhood art studios.", year: 2023 },
  ] };
  const shown = { $filter: { list: { $data: "projects" }, field: "kind", equals: S("kind"), skipIf: "all" } };
  doc.blocks = {
    root: { type: "page", props: { width: "wide", gap: 8 }, slots: { children: ["hero", "filter", "work", "contact", "thanks"] } },
    hero: { type: "section", props: { eyebrow: "Portfolio", title: "Design and research for small teams", description: "Selected work from the last three years, and a way to get in touch.", inset: 0 } },
    filter: { type: "dropdown", props: { label: "Show", options: [{ value: "all", label: "All work" }, { value: "Product", label: "Product" }, { value: "Brand", label: "Brand" }, { value: "Research", label: "Research" }] }, ...bindValue("kind") },
    work: { type: "grid", props: { columns: 2, minSize: "medium", gap: 4 }, slots: { children: ["project"] } },
    project: { type: "card", props: {}, bind: { title: { $item: "name" }, subtitle: { $concat: [{ $item: "kind" }, " · ", { $item: "year" }] } }, repeat: { each: { $sort: { list: shown, field: "year", direction: "desc" } } as never, key: "id", as: "project" }, slots: { children: ["project-summary"] } },
    "project-summary": { type: "text", props: { variant: "body" }, bind: { text: { $item: "summary" } } },
    contact: { type: "form", props: { label: "Get in touch", submitLabel: "Send message" }, slots: { children: ["who", "email", "message"] }, on: { submit: [set("sent", { $event: "values" })] } },
    who: { type: "text-field", props: { label: "Your name", name: "who", required: true } },
    email: { type: "text-field", props: { label: "Your email", name: "email", kind: "email", required: true } },
    message: { type: "textarea", props: { label: "What would you like to talk about?", rows: 5 } },
    thanks: { type: "alert", props: { tone: "success", title: "Message ready", text: "Thanks. Your message has been recorded and a reply will follow." }, visible: { $neq: [S("sent"), null] } },
  };
  return doc;
}
