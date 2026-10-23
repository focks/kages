// The Library's brain: everything about *which* Kages show and in what order,
// as pure functions over the card summaries `list_kages` returns. No React and no
// fetching, so the behaviour is unit-tested and the URL is the single source of
// truth for the view (a shared link reproduces the exact filtered, sorted view).
// See the dashboard-over-adapters skill.

/** The subset of a `list_kages` card the library reads. Declared here (not
 *  imported from the UI module) so this file runs under `node --test`. */
export interface LibraryCard {
  name: string; repo: string; title: string; system: string; blocks: number; version: number;
  state: string; visibility: string; lastAuthor: string; createdAt: string;
  description: string; kinds: string[];
  /** The Kage's declared mode, or null/absent when it has no brief. */
  mode?: string | null;
  /** Every project the Kage is in: its home `repo` unioned with its extra memberships.
   *  A card can be "in" more than one project, so the project filter and counts read
   *  this, not just `repo`. Absent on an old card payload → treated as just [repo]. */
  projects?: string[];
}

/** The projects a card belongs to, tolerant of an older payload that only had `repo`:
 *  a card is always in its home repo, even if `projects` was not sent. */
const projectsOf = (c: LibraryCard): string[] => (c.projects?.length ? c.projects : [c.repo]);
/** A card passes a project filter iff that project is its home repo or in its membership. */
export const inProject = (c: LibraryCard, project: string): boolean => c.repo === project || projectsOf(c).includes(project);

export type Scope = "auto" | "mine" | "pinned" | "all";
export type Sort = "updated" | "name" | "blocks" | "status";
export type Group = "none" | "project" | "status" | "system";
export type View = "grid" | "list";

export interface Query {
  q: string;
  scope: Scope;
  repo: string;          // "" = any project
  states: string[];      // empty = default (everything except archived)
  systems: string[];     // empty = any
  modes: string[];       // empty = any (declared modes only)
  sort: Sort;
  group: Group;
  view: View;
}

export const DEFAULT_QUERY: Query = { q: "", scope: "auto", repo: "", states: [], systems: [], modes: [], sort: "updated", group: "none", view: "grid" };

/** The repo that holds shipped example Kages. They are real Kages, but a person
 *  browsing for their own work should not have to wade through them. */

/** Lifecycle order is the order people think in (draft → live → retired), not alphabetical. */
export const STATE_ORDER = ["draft", "review", "published", "deprecated", "archived"];
export const STATE_LABEL: Record<string, string> = { draft: "Draft", review: "In review", published: "Published", deprecated: "Deprecated", archived: "Archived" };
export const SYSTEM_ORDER = ["core", "ledger", "atelier"];
export const MODE_ORDER = ["read", "operate", "persuade", "experience"];
export const MODE_LABEL: Record<string, string> = { read: "Read", operate: "Operate", persuade: "Persuade", experience: "Experience" };
const SCOPES: Scope[] = ["auto", "mine", "pinned", "all"];
const SORTS: Sort[] = ["updated", "name", "blocks", "status"];
const GROUPS: Group[] = ["none", "project", "status", "system"];
const VIEWS: View[] = ["grid", "list"];
export const SORT_LABEL: Record<Sort, string> = { updated: "Recently updated", name: "Name (A–Z)", blocks: "Most blocks", status: "Status" };
export const GROUP_LABEL: Record<Group, string> = { none: "No grouping", project: "Group by project", status: "Group by status", system: "Group by system" };

const pickOne = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const pickMany = (v: string | null, allowed?: readonly string[]): string[] =>
  [...new Set((v ?? "").split(",").map((x) => x.trim()).filter((x) => x && (!allowed || allowed.includes(x))))];

/** Tolerant parse: an unknown or hand-edited value falls back to the default
 *  instead of breaking the page, so old or shared links never 500. */
export function parseQuery(sp: { get(name: string): string | null }): Query {
  return {
    q: (sp.get("q") ?? "").slice(0, 200),
    scope: pickOne(sp.get("scope"), SCOPES, "auto"),
    repo: /^[a-z0-9][a-z0-9-]{0,63}$/.test(sp.get("repo") ?? "") ? sp.get("repo")! : "",
    states: pickMany(sp.get("state"), STATE_ORDER),
    systems: pickMany(sp.get("sys"), SYSTEM_ORDER),
    modes: pickMany(sp.get("mode"), MODE_ORDER),
    sort: pickOne(sp.get("sort"), SORTS, "updated"),
    group: pickOne(sp.get("group"), GROUPS, "none"),
    view: pickOne(sp.get("view"), VIEWS, "grid"),
  };
}

/** Only non-default values are written, so the common URL is just `/artifacts`. */
export function serializeQuery(q: Query): URLSearchParams {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.scope !== "auto") p.set("scope", q.scope);
  if (q.repo) p.set("repo", q.repo);
  if (q.states.length) p.set("state", q.states.join(","));
  if (q.systems.length) p.set("sys", q.systems.join(","));
  if (q.modes.length) p.set("mode", q.modes.join(","));
  if (q.sort !== "updated") p.set("sort", q.sort);
  if (q.group !== "none") p.set("group", q.group);
  if (q.view !== "grid") p.set("view", q.view);
  return p;
}

/** "auto" opens on "mine". There is no separate class of starter Kage any more, so
 *  "mine" is every Kage the caller can read and never opens empty on a seeded workspace. */
export function resolveScope(scope: Scope, cards: readonly LibraryCard[]): Exclude<Scope, "auto"> {
  if (scope !== "auto") return scope;
  void cards;
  return "mine";
}

const systemId = (c: LibraryCard) => c.system.split("@")[0];

/** Every whitespace-separated term must appear somewhere in the card's text. */
function matchesText(c: LibraryCard, q: string): boolean {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = [c.title, c.name, c.description, c.repo, c.system, c.state, c.lastAuthor, c.mode ?? "", ...c.kinds].join(" ").toLowerCase();
  return terms.every((t) => hay.includes(t));
}

/** Each facet can be left out of the test, which is how counts are computed: a
 *  facet's own selection must not hide its siblings, or you could never see what
 *  else there is to pick (the standard faceted-search rule). */
type FacetName = "scope" | "repo" | "state" | "system" | "mode";
function passes(c: LibraryCard, q: Query, scope: Exclude<Scope, "auto">, pins: ReadonlySet<string>, keep: string | undefined, skip?: FacetName): boolean {
  if (!matchesText(c, q.q)) return false;
  if (skip !== "scope") {
    if (scope === "pinned" && !pins.has(c.name)) return false;
  }
  // A project filter matches on membership, not just the home repo: a Kage tagged into a project shows under it.
  if (skip !== "repo" && q.repo && !inProject(c, q.repo)) return false;
  if (skip !== "system" && q.systems.length && !q.systems.includes(systemId(c))) return false;
  if (skip !== "mode" && q.modes.length && !(c.mode && q.modes.includes(c.mode))) return false;
  if (skip !== "state") {
    // Archived Kages stay out of the way unless asked for (or open right now).
    if (q.states.length ? !q.states.includes(c.state) : c.state === "archived" && c.name !== keep) return false;
  }
  return true;
}

export function filterCards<T extends LibraryCard>(cards: readonly T[], q: Query, pins: ReadonlySet<string>, keep?: string): T[] {
  const scope = resolveScope(q.scope, cards);
  return cards.filter((c) => passes(c, q, scope, pins, keep));
}

const byTitle = (a: LibraryCard, b: LibraryCard) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }) || a.name.localeCompare(b.name);
/** Newest first; a bad date sorts last rather than throwing or scrambling order. */
const time = (c: LibraryCard) => { const t = Date.parse(c.createdAt); return Number.isNaN(t) ? -Infinity : t; };

export function sortCards<T extends LibraryCard>(cards: readonly T[], sort: Sort): T[] {
  const out = [...cards];
  const cmp: Record<Sort, (a: LibraryCard, b: LibraryCard) => number> = {
    updated: (a, b) => time(b) - time(a) || byTitle(a, b),
    name: byTitle,
    blocks: (a, b) => b.blocks - a.blocks || byTitle(a, b),
    status: (a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) || time(b) - time(a) || byTitle(a, b),
  };
  return out.sort((a, b) => { const d = cmp[sort](a, b); return Number.isNaN(d) ? 0 : d; });
}

export interface CardGroup<T extends LibraryCard = LibraryCard> { key: string; label: string; items: T[] }

/** Groups keep the incoming (already sorted) order inside each group; the groups
 *  themselves follow a meaningful order, not insertion order. */
export function groupCards<T extends LibraryCard>(cards: readonly T[], group: Group): CardGroup<T>[] {
  if (group === "none") return [{ key: "all", label: "", items: [...cards] }];
  const keyOf = (c: T) => group === "project" ? c.repo : group === "status" ? c.state : systemId(c);
  const map = new Map<string, T[]>();
  for (const c of cards) { const k = keyOf(c); const list = map.get(k); if (list) list.push(c); else map.set(k, [c]); }
  const rank = (k: string) => group === "status" ? STATE_ORDER.indexOf(k) : group === "system" ? SYSTEM_ORDER.indexOf(k) : 0;
  const label = (k: string) => group === "status" ? STATE_LABEL[k] ?? k : k;
  return [...map.entries()]
    .sort(([a], [b]) => (group === "project" ? a.localeCompare(b) : (rank(a) < 0 ? 99 : rank(a)) - (rank(b) < 0 ? 99 : rank(b)) || a.localeCompare(b)))
    .map(([key, items]) => ({ key, label: label(key), items }));
}

export interface Facets {
  scope: Record<Exclude<Scope, "auto">, number>;
  repos: { repo: string; count: number }[];
  states: Record<string, number>;
  systems: Record<string, number>;
  /** Declared modes only; Kages with no brief are not counted under any mode. */
  modes: Record<string, number>;
}

/** Counts for every facet value under the *other* active filters. */
export function facetCounts(cards: readonly LibraryCard[], q: Query, pins: ReadonlySet<string>, keep?: string): Facets {
  const scope = resolveScope(q.scope, cards);
  const scopeCounts = { mine: 0, pinned: 0, all: 0 };
  const repos = new Map<string, number>(), states: Record<string, number> = {}, systems: Record<string, number> = {}, modes: Record<string, number> = {};
  for (const c of cards) {
    // Scope counts ignore the scope facet itself so the tabs show what each would contain.
    if (passes(c, q, "all", pins, keep, "scope")) {
      scopeCounts.all++;
      scopeCounts.mine++;
      if (pins.has(c.name)) scopeCounts.pinned++;
    }
    // Count under EVERY project the card is in, not just its home repo, so a multi-project Kage lifts each project's count.
    if (passes(c, q, scope, pins, keep, "repo")) for (const p of projectsOf(c)) repos.set(p, (repos.get(p) ?? 0) + 1);
    if (passes(c, q, scope, pins, keep, "state")) states[c.state] = (states[c.state] ?? 0) + 1;
    if (passes(c, q, scope, pins, keep, "system")) systems[systemId(c)] = (systems[systemId(c)] ?? 0) + 1;
    if (c.mode && passes(c, q, scope, pins, keep, "mode")) modes[c.mode] = (modes[c.mode] ?? 0) + 1;
  }
  return {
    scope: scopeCounts,
    repos: [...repos.entries()].map(([repo, count]) => ({ repo, count })).sort((a, b) => a.repo.localeCompare(b.repo)),
    states, systems, modes,
  };
}

export interface Chip { key: string; label: string; clear: Partial<Query> }

/** Removable summary of everything narrowing the view beyond the default. */
export function activeChips(q: Query): Chip[] {
  const chips: Chip[] = [];
  if (q.q) chips.push({ key: "q", label: `“${q.q}”`, clear: { q: "" } });
  if (q.repo) chips.push({ key: "repo", label: `Project: ${q.repo}`, clear: { repo: "" } });
  for (const s of q.states) chips.push({ key: "state:" + s, label: STATE_LABEL[s] ?? s, clear: { states: q.states.filter((x) => x !== s) } });
  for (const s of q.systems) chips.push({ key: "sys:" + s, label: s[0].toUpperCase() + s.slice(1), clear: { systems: q.systems.filter((x) => x !== s) } });
  for (const m of q.modes) chips.push({ key: "mode:" + m, label: MODE_LABEL[m] ?? m, clear: { modes: q.modes.filter((x) => x !== m) } });
  return chips;
}

/** Toggle membership immutably (used by the multi-select facets). */
export function toggle(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/** Pins are a per-viewer convenience kept in the browser; this just keeps the
 *  stored shape defensive (an old or corrupt value must never crash the page). */
export function parsePins(raw: string | null): Set<string> {
  try { const v = JSON.parse(raw ?? "[]"); return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 500) : []); }
  catch { return new Set(); }
}
