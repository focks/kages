// The Library's filtering, faceting, sorting, grouping and URL round-trip.
// Everything the page decides about what to show lives here, so it is pinned
// without a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_QUERY, parseQuery, serializeQuery, resolveScope, filterCards, sortCards, groupCards, facetCounts, activeChips, toggle, parsePins, type LibraryCard, type Query } from "./library-model.ts";

const card = (over: Partial<LibraryCard>): LibraryCard => ({ name: "k", repo: "ops", title: "K", system: "core@1.0.0", blocks: 5, version: 1, state: "draft", visibility: "private", lastAuthor: "agent:a", createdAt: "2026-03-01T00:00:00Z", description: "", kinds: [], ...over });
const CARDS: LibraryCard[] = [
  card({ name: "ops-console", title: "Ops console", repo: "ops", system: "ledger@2.0.0", state: "published", blocks: 24, createdAt: "2026-03-05T00:00:00Z", description: "Weekly order operations", kinds: ["table", "dropdown"] }),
  card({ name: "revenue", title: "Revenue board", repo: "finance", system: "ledger@2.0.0", state: "published", blocks: 12, createdAt: "2026-03-04T00:00:00Z", kinds: ["bar-chart", "stat"] }),
  card({ name: "story", title: "Weekly story", repo: "growth", system: "atelier@1.0.0", state: "draft", blocks: 8, createdAt: "2026-03-06T00:00:00Z" }),
  card({ name: "old", title: "Launch checklist", repo: "ops", state: "archived", blocks: 3, createdAt: "2026-01-01T00:00:00Z" }),
  card({ name: "field-notes", title: "Field notes", repo: "notes", state: "draft", blocks: 7, createdAt: "2026-02-01T00:00:00Z", description: "A reading page" }),
  card({ name: "charts", title: "Quarterly report", repo: "notes", state: "draft", blocks: 9, createdAt: "2026-02-02T00:00:00Z", kinds: ["combo-chart", "map"] }),
];
const q = (over: Partial<Query> = {}): Query => ({ ...DEFAULT_QUERY, ...over });
const names = (cs: LibraryCard[]) => cs.map((c) => c.name);
const none = new Set<string>();

test("the URL round-trips and defaults stay out of it", () => {
  assert.equal(serializeQuery(DEFAULT_QUERY).toString(), "");
  const full = q({ q: "weekly", scope: "pinned", repo: "ops", states: ["draft", "review"], systems: ["core"], sort: "name", group: "status", view: "list" });
  assert.deepEqual(parseQuery(serializeQuery(full)), full);
  assert.equal(serializeQuery(full).get("state"), "draft,review");
});

test("hand-edited and hostile URL values fall back instead of breaking the page", () => {
  const p = new URLSearchParams({ scope: "everything", sort: "random", group: "<x>", view: "cube", repo: "../etc/passwd", state: "draft,bogus,draft,archived", sys: "core,evil", q: "x".repeat(900) });
  const got = parseQuery(p);
  assert.deepEqual([got.scope, got.sort, got.group, got.view, got.repo], ["auto", "updated", "none", "grid", ""]);
  assert.deepEqual(got.states, ["draft", "archived"], "unknown and duplicate states are dropped"); assert.deepEqual(got.systems, ["core"]);
  assert.equal(got.q.length, 200);
  assert.deepEqual(parseQuery(new URLSearchParams()), DEFAULT_QUERY);
});

test("auto scope opens on every Kage; there is no separate class of starter", () => {
  assert.equal(resolveScope("auto", CARDS), "mine");
  assert.equal(resolveScope("auto", []), "mine", "an empty workspace opens on the same view");
  assert.equal(resolveScope("pinned", CARDS), "pinned", "an explicit choice is honoured");
});

test("scopes: everything by default, and pins", () => {
  assert.equal(filterCards(CARDS, q(), none).length, 5, "default: every Kage, archived hidden");
  assert.deepEqual(names(filterCards(CARDS, q({ scope: "pinned" }), new Set(["story", "charts", "gone"]))), ["story", "charts"]);
  assert.equal(filterCards(CARDS, q({ scope: "all" }), none).length, 5, "all, minus archived");
});

test("archived Kages appear only when asked for, or while one is open", () => {
  assert.ok(!names(filterCards(CARDS, q({ scope: "all" }), none)).includes("old"));
  assert.ok(names(filterCards(CARDS, q({ scope: "all", states: ["archived"] }), none)).includes("old"));
  assert.deepEqual(names(filterCards(CARDS, q({ scope: "all", states: ["archived"] }), none)), ["old"], "an explicit state replaces the default");
  assert.ok(names(filterCards(CARDS, q({ scope: "all" }), none, "old")).includes("old"), "the open one never vanishes from under the user");
});

test("search needs every term, across title, description, project, kinds and author", () => {
  const f = (s: string) => names(filterCards(CARDS, q({ scope: "all", q: s }), none));
  assert.deepEqual(f("revenue"), ["revenue"]); assert.deepEqual(f("WEEKLY"), ["ops-console", "story"], "case-insensitive, matches description too");
  assert.deepEqual(f("weekly order"), ["ops-console"], "all terms must match"); assert.deepEqual(f("bar-chart"), ["revenue"], "block kinds are searchable");
  assert.deepEqual(f("finance"), ["revenue"]); assert.deepEqual(f("   "), f("")); assert.deepEqual(f("nothing like this"), []);
});

test("filters combine: project, status and system narrow together", () => {
  const f = (o: Partial<Query>) => names(filterCards(CARDS, q({ scope: "all", ...o }), none));
  assert.deepEqual(f({ repo: "ops" }), ["ops-console"]); assert.deepEqual(f({ states: ["published"] }), ["ops-console", "revenue"]);
  assert.deepEqual(f({ systems: ["atelier"] }), ["story"]); assert.deepEqual(f({ systems: ["ledger", "atelier"], states: ["draft", "published"] }), ["ops-console", "revenue", "story"]);
  assert.deepEqual(f({ repo: "ops", states: ["draft"] }), []);
});

test("sorting is stable, meaningful and tolerates bad data", () => {
  const live = filterCards(CARDS, q({ scope: "all" }), none);
  assert.deepEqual(names(sortCards(live, "updated")), ["story", "ops-console", "revenue", "charts", "field-notes"]);
  assert.deepEqual(names(sortCards(live, "name")), ["field-notes", "ops-console", "charts", "revenue", "story"].sort((a, b) => CARDS.find((c) => c.name === a)!.title.localeCompare(CARDS.find((c) => c.name === b)!.title)));
  assert.deepEqual(names(sortCards(live, "blocks")), ["ops-console", "revenue", "charts", "story", "field-notes"]);
  assert.deepEqual(names(sortCards(live, "status")).slice(0, 3), ["story", "charts", "field-notes"], "drafts first, newest first within a state");
  assert.equal(sortCards(live, "status")[0].state, "draft"); assert.equal(sortCards(live, "status").at(-1)!.state, "published");
  const bad = [card({ name: "a", createdAt: "not a date" }), card({ name: "b", createdAt: "2026-05-01T00:00:00Z" })];
  assert.deepEqual(names(sortCards(bad, "updated")), ["b", "a"], "an unparseable date sorts last");
  const input = [...live]; sortCards(input, "name"); assert.deepEqual(input, live, "the input array is not mutated");
});

test("grouping orders groups meaningfully: lifecycle, system, and project name", () => {
  const live = sortCards(filterCards(CARDS, q({ scope: "all" }), none), "updated");
  assert.deepEqual(groupCards(live, "status").map((g) => g.label), ["Draft", "Published"]);
  assert.deepEqual(groupCards(live, "system").map((g) => g.key), ["core", "ledger", "atelier"].filter((k) => live.some((c) => c.system.startsWith(k))));
  const projects = groupCards(live, "project").map((g) => g.key); assert.deepEqual(projects, [...projects].sort());
  assert.deepEqual(groupCards(live, "none").map((g) => g.items.length), [live.length]);
  assert.deepEqual(names(groupCards(live, "status")[1].items), ["ops-console", "revenue"], "order inside a group is preserved");
});

test("facet counts reflect the other filters but never their own selection", () => {
  const f = facetCounts(CARDS, q({ scope: "all", states: ["published"] }), none);
  assert.deepEqual(f.states, { draft: 3, published: 2, archived: 1 }, "choosing Published must not hide the other counts, and archived stays discoverable");
  assert.deepEqual(f.systems, { ledger: 2 }, "systems count only the published Kages");
  assert.deepEqual(f.repos.map((r) => r.repo), ["finance", "ops"]);
  const all = facetCounts(CARDS, q(), none); assert.deepEqual(all.scope, { mine: 5, pinned: 0, all: 5 });
  assert.equal(facetCounts(CARDS, q({ repo: "ops" }), none).scope.all, 1, "a project filter narrows the scope counts");
  assert.deepEqual(facetCounts(CARDS, q({ q: "weekly" }), new Set(["story"])).scope, { mine: 2, pinned: 1, all: 2 });
});

test("active chips describe every narrowing and each one clears itself", () => {
  const query = q({ q: "x", repo: "ops", states: ["draft", "review"], systems: ["core"] });
  const chips = activeChips(query); assert.deepEqual(chips.map((c) => c.label), ["“x”", "Project: ops", "Draft", "In review", "Core"]);
  assert.deepEqual({ ...query, ...chips[2].clear }.states, ["review"]); assert.equal({ ...query, ...chips[0].clear }.q, "");
  assert.deepEqual(activeChips(DEFAULT_QUERY), []);
});

test("toggle is immutable and pins parse defensively", () => {
  const a = ["x"]; assert.deepEqual(toggle(a, "y"), ["x", "y"]); assert.deepEqual(toggle(a, "x"), []); assert.deepEqual(a, ["x"]);
  assert.deepEqual([...parsePins('["a","b",3,null]')], ["a", "b"]); for (const bad of [null, "", "{", "7", '{"a":1}']) assert.equal(parsePins(bad).size, 0, String(bad));
  assert.equal(parsePins(JSON.stringify(Array.from({ length: 9000 }, (_, i) => "k" + i))).size, 500, "bounded");
});

test("a Kage in multiple projects passes the filter and lifts the count of every project it is in", () => {
  // Home repo "ops", also tagged into "shared" and "weekly". The home repo is always in the set.
  const multi = card({ name: "multi", repo: "ops", state: "published", projects: ["ops", "shared", "weekly"] });
  const plain = card({ name: "plain", repo: "finance", state: "published", projects: ["finance"] });
  const legacy = card({ name: "legacy", repo: "growth", state: "published" }); // no `projects` field: treated as [repo]
  const cards = [multi, plain, legacy];
  const base = q({ scope: "all" as const });
  const pick = (repo: string) => names(filterCards(cards, q({ scope: "all", repo }), none));
  assert.deepEqual(pick("ops"), ["multi"], "home repo matches");
  assert.deepEqual(pick("shared"), ["multi"], "a membership project matches even though it is not the home repo");
  assert.deepEqual(pick("weekly"), ["multi"]);
  assert.deepEqual(pick("growth"), ["legacy"], "an old card with no projects field still matches on its repo");
  assert.deepEqual(pick("finance"), ["plain"]);
  const f = facetCounts(cards, base, none);
  const count = (repo: string) => f.repos.find((r) => r.repo === repo)?.count ?? 0;
  assert.equal(count("ops"), 1); assert.equal(count("shared"), 1); assert.equal(count("weekly"), 1);
  assert.equal(count("finance"), 1); assert.equal(count("growth"), 1);
  assert.deepEqual(f.repos.map((r) => r.repo), ["finance", "growth", "ops", "shared", "weekly"], "every project the cards touch is a facet, sorted");
});

test("mode facet: declared modes filter, count under other filters, round-trip the URL, and undeclared Kages are never counted", () => {
  const card = (name: string, mode: string | null | undefined, over: Partial<LibraryCard> = {}): LibraryCard => ({ name, repo: "kages", title: name, system: "core@1", blocks: 3, version: 1, state: "published", visibility: "private", lastAuthor: "u", createdAt: "2026-01-01T00:00:00Z", description: "", kinds: [], mode, ...over });
  const cards = [card("a", "read"), card("b", "operate"), card("c", "operate", { system: "ledger@2" }), card("d", null), card("e", undefined)];
  const q = { ...DEFAULT_QUERY, scope: "all" as const };
  assert.deepEqual(filterCards(cards, { ...q, modes: ["operate"] }, new Set()).map((c) => c.name), ["b", "c"]);
  assert.equal(filterCards(cards, q, new Set()).length, 5, "no mode filter shows everything, declared or not");
  assert.deepEqual(facetCounts(cards, q, new Set()).modes, { read: 1, operate: 2 });
  // Selecting a system narrows the mode counts (the other facets apply), but a mode's own selection does not hide its siblings.
  assert.deepEqual(facetCounts(cards, { ...q, systems: ["ledger"] }, new Set()).modes, { operate: 1 });
  assert.deepEqual(facetCounts(cards, { ...q, modes: ["read"] }, new Set()).modes, { read: 1, operate: 2 });
  const url = serializeQuery({ ...q, modes: ["read", "operate"] });
  assert.equal(url.get("mode"), "read,operate");
  assert.deepEqual(parseQuery(new URLSearchParams("mode=operate,bogus")).modes, ["operate"]);
  assert.deepEqual(activeChips({ ...q, modes: ["persuade"] }).map((c) => c.label), ["Persuade"]);
});
