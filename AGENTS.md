# Kages — agent guide

An artifactory for agents: any agent, on any model or protocol, creates
versioned interactive artifacts by assembling **blocks** from a **design
system** against published **contracts**. Agents never write HTML.

This repo is **AI-native**: every load-bearing pattern and convention lives as a
skill under `.claude/skills/`. Read the relevant skill before touching code —
the pattern is captured so you inherit it instead of rediscovering it. When you
find a new reusable pattern, add it as a skill.

## Start here

| Skill | When |
| --- | --- |
| `kages-architecture` | Before changing engine, store, adapters, or runtime — the layer map, the oracle-as-truth rule, the golden-test pattern, the invariants. |
| `how-to-extend-kages` | Adding a design system, component/role override, or protocol adapter. |
| `free-flow-composition` | Artifact layouts, content blocks, or agent authoring guidance — additive oracle compilation and responsive composition. |
| `comment-doctrine` | Writing or editing any code. Comment the *why* and the *failure mode*, never the *what*. |
| `dashboard-over-adapters` | Building or changing any page that reads/writes Kages — UI talks to the store only through `/api/<op>`. |
| `expressive-artifacts` | Changing repeats, computations, reusable compositions, visual blocks, or generation envelopes. |
| `research-briefs` | Writing a long, sourced page: contents, citations, attributed quotes, captioned figures, a self-check, glossary and references. |
| `visual-review` | Rendering a Kage to a PNG with checks (`kages screenshot`, MCP `render_kage`); the /render page. |
| `discussion-comments` | Threaded comments, votes, pinned point comments and comment mode; `src/collab/comments.ts` and `src/components/dashboard/comments`. |
| `persistence-backends` | Changing how workspaces persist: Postgres/Supabase/in-memory, CAS writes, `db:setup`. |
| `rich-artifacts` | Adding or changing a chart, disclosure, overlay or other rich block in `src/design-system/rich*.js`. |
| `kages-cli` | Adding or changing a `kages` CLI command, or the file-backed workspace store. |
| `testing-conventions` | Adding a test or a testable module (node --test, native TS, injected clocks). |
| `kages-app-design-system` | Before adding or changing any UI: tokens, type, states, the Kage boundary. |

## Layout

```
oracle/            functional requirements, BDD/Gherkin — the acceptance criteria
originals/         the reference implementation (the oracle); gitignored, source of truth when present
reference/         tracked snapshot of the pristine oracle — build:ds falls back to it, so originals/ is optional
src/engine/        pure shared engine: resolve · evaluate · validate · describe · catalog · generation · session
src/engine/data/   registry data extracted from the reference (generated)
src/engine/__fixtures__/  fixtures + golden outputs captured from the reference
src/runtime/       React renderer (@kages/runtime) + DS-bundle loader — drives the trusted bundle with the engine
src/design-system/ additive portable components/styles compiled into the reference oracle
src/store/         artifactory: immutable signed versions, provenance, lifecycle, RBAC, search, events, quotas
src/collab/        RFC6902 patch · block-level three-way merge · claims/leases · comments
src/adapters/      one operation table → REST · MCP tools · A2A card · OpenAPI (all generated)
src/cli/           the `kages` CLI: toolsets over the operation table + a file-backed workspace store
bin/kages.mjs      CLI entry (package.json `bin`)
src/packs/         skill packs per system (SKILL.md/AGENTS.md/llms.txt/catalog), generated from the registry
src/host/          the host bridge: gated capabilities (storage/ask/agent/connector/fetch/viewer/emit)
src/components/dashboard/  dashboard UI primitives (inline-SVG icons, state badges, system chips)
src/app/           Next.js app: /artifacts (dashboard, New Kage starter picker, fullscreen preview overlay), /api/[op], /api/openapi.json, /.well-known/agent-card.json
public/ds/         served design-system bundle assets (bundle.js/css, tokens, fixture)
scripts/           extract-data.mjs, golden.mjs — regenerate data + goldens from originals/
```

## Status

The oracle features are implemented and tested (`npm test` covers engine,
compositions, design-system rendering, CLI, store and collaboration).
Milestones 1–9 of the build plan are complete: engine (golden-faithful to the
oracle), runtime (headless + React, System Swap), store + collab, adapters +
packs, host bridge + viewer, plus the `kages` CLI with a persistent
local workspace.

## Commands

- `npm test` — engine + CLI tests (`node --test`, native TS, no framework)
- `node bin/kages.mjs help` (or `npx kages`) — the CLI; `kages validate <file>` works offline
- `npm run typecheck` — `tsc --noEmit`
- `npm run dev` / `npm run build` — Next.js
- `npm run db:setup` — create the local Postgres database and tables for `DATABASE_URL`

## The two rules that never bend

1. **The oracle wins.** `originals/` is the source of truth; port its behaviour
   and keep its fixtures passing (`ops-console` → 0/0/portable in all three
   systems; the broken doc → exactly 6 errors + 1 warning). Add a golden before
   adding engine behaviour.
2. **The engine stays pure.** `src/engine/` depends on nothing below it. A Kage
   is untrusted data: validated, never executed; no expression reaches `window`
   or prototypes.
