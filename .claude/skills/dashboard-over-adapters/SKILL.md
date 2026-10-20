---
name: dashboard-over-adapters
description: "How UI in this repo talks to the store — never directly. Every dashboard and viewer page is just another adapter client that calls the one operation set over REST (/api/<op>), with no privileged access. Covers the master-detail workbench pattern (list + detail tabs), the list_kages/list_versions summary ops, and why UI logic belongs in operations, not components. Read before building or changing any page under src/app that reads or writes Kages."
---

# dashboard-over-adapters

Every UI surface is an **adapter client**, not a privileged insider. The
Artifacts dashboard and the viewer both reach the store the exact
way an external agent does — through the one operation set over REST
(`POST /api/<op>`). A page never imports the `Store` and never calls engine
write paths directly. This keeps one source of truth for permissions,
validation and provenance, and means anything the UI can do, an agent can too
(and vice versa).

## The rule

> UI reads and writes Kages ONLY through `/api/<op>`. If a page needs data the
> operation table doesn't expose, add an operation — don't reach around it.

```ts
async function op<T>(name: string, params = {}): Promise<T> {
  const res = await fetch(`/api/${name}`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(params) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.msg || res.statusText);
  return data as T;
}
```

## Summary ops vs document ops

A list view should not pull every document. Add a **summary operation** that
returns just what the list needs and strips the heavy `doc`:

- `list_kages` → one card per Kage (title, system, blocks, version, state,
  visibility, validation, author, time). No documents.
- `list_versions` → the revision history with provenance, `doc` removed per
  record (a long history stays cheap).
- `get_kage` / `describe_kage` / `preview_kage` → pulled lazily, only for the
  **selected** item.

New summary op → `src/adapters/operations.ts` (it appears in REST/MCP/CLI/
OpenAPI automatically, since surfaces are generated — see
`how-to-extend-kages`).

## The Library (current dashboard)

`/artifacts` (also `/kages`, `/library`) is the **Library**, not a master-detail
pair. Logic is the pure `src/components/dashboard/library-model.ts`
(`parseQuery`/`serializeQuery`, `filterCards`, `sortCards`, `groupCards`,
`facetCounts`, `activeChips`), unit-tested without a browser; components are
layout over it (`library/facet-rail`, `kage-tile`, `detail-sheet`).

- **The URL is the state** (`q scope repo state sys sort group view id`); only
  non-defaults are written; unknown values fall back. Filters `replace`, opening a
  Kage `push`es so Back closes the panel.
- **Scopes** split "My Kages" from the shipped `templates` repo (`auto` picks mine
  when you have any). Facet counts exclude the facet's own selection, otherwise
  choosing a value hides its siblings.
- **A card is one button** whose `::after` stretches over it; pin/preview sit above.
  Pins are per-viewer (`localStorage` `kages.pins`), never a server field.
- **Summary fields come from the op.** `list_kages` returns `description` and
  `kinds` (characteristic block types) so cards describe a Kage without shipping
  documents; add new list fields there, not in the page.
- Row/column density uses **container queries** (`@container`, `@2xl:`), because the
  list sits beside two sidebars and viewport breakpoints lie.

## The older master-detail workbench (superseded)

The dashboard pattern (inspired by the devi artifacts workbench):

- **Master** (left): `list_kages` → one card each; search + system/state
  filters are client-side over that list.
- **Detail** (right): on select, fetch `get_kage` + `list_versions` +
  `describe_kage` in parallel; show tabs — Overview (metadata), Versions
  (history with digests/provenance), Describe (text view), Preview (embed
  `<KageRenderer doc={...}/>`).
- **Actions** are operations: Publish → `publish_kage`, Export → `export_kage`
  (download the blob), Import → `create_kage` with the parsed file, Open →
  link to `/viewer?kage=<name>` / `/artifacts?id=<name>`.
- Deep-linkable pages take `?kage=<name>` and load via `get_kage`, falling back
  to the bundled fixture.

## UI primitives

Inline-SVG icons only — Kages ships no icon font (`src/components/dashboard/
ui.tsx`: `Icon`, `StateBadge`, `SystemChip`). Palette mirrors the token roles
(paper/surface/ink/wire). A system's identity is a monogram tile, matching the
spec's iconography rule.

## Share pages that agents can read

A share link (`/k/<uuid>`) is for people, and the same address answers agents in markdown. One reader, `readSharedDoc(uuid)` in `src/server/shared-doc.ts`, enforces who may read (link/public visibility only) for the JSON route, the page and the markdown route; never re-implement that check.

- `/k/<uuid>.md`, or `/k/<uuid>` with `Accept: text/markdown`, is rewritten in `next.config.ts` to `/api/shared/<uuid>/md`. The page advertises it with a `Link: rel="alternate"` header (and `Vary: Accept`) plus a `<link rel="alternate" type="text/markdown">` in the head.
- `src/server/agent-markdown.ts` (pure) puts **install and call instructions first** and the Kage's own text after, **fenced as untrusted data**: the same rule as the workspace brief. Gotcha: `modeOf` returns an object; print `m.mode`/`m.source`, not `${m}`.
- `/agents.md` (`src/server/agents-guide.ts`, route in `src/app/agents.md`) is the site guide with this deployment's own origin baked in; `public/llms.txt` indexes both. Add an operation or a recommended call order, then update the guide and its test.
- The human-side counterpart is the "Are you an agent?" panel (`kages-app-design-system`). Both build their commands from the request's origin, so they never name the wrong host.

## Why this is the scalable shape

Put a filter, a bulk action, or a new view behind an operation and it is
instantly available to the dashboard, the CLI, an MCP client, and an A2A agent
at once. Put it in a component and only that component has it. Logic lives in
the operation table; pages are layout over `fetch`.
