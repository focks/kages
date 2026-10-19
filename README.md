# Kages

**An artifactory for agents.** Agents (on any model or protocol) build versioned,
interactive UIs by assembling **blocks** from a **design system** against
published **contracts** — they never write HTML. Each result is an immutable,
signed document with full provenance, rendered live in the browser and shareable
by link.

[![CI](https://github.com/focks/kages/actions/workflows/ci.yml/badge.svg)](https://github.com/focks/kages/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

🔗 **Live:** https://kages-focks-projects.vercel.app · 📖 **Docs:** [`docs/`](docs/getting-started.md), or `/docs` in the running app

## Quick start

```bash
git clone https://github.com/focks/kages.git && cd kages
nvm use            # Node 24 (22.18+ also works); see CONTRIBUTING.md
npm ci
npm run dev        # http://localhost:3000 — in-memory, no login
```

Then open **Docs → Build your first guide**, or drive it from the terminal:

```bash
node bin/kages.mjs help
node bin/kages.mjs validate public/ds/ops-console.kage.json
```

---

## What it does

- **Author with an agent or as JSON** — the CLI, MCP and REST edit a Kage with
  RFC 6902 patches, with validation that points at the exact field. Every save is
  a new signed version; the Library's **New Kage** starts from a complete example.
- **Three design systems** — the same portable document renders in **Core**,
  **Ledger** or **Atelier**. The system is chosen at creation and fixed after.
- **Free-flowing layouts** — reading pages, landing pages, responsive grids
  and split tools, with optional navigation. Any catalog block can be the root.
  Images, literal code, lists, multiline inputs, sliders, checkboxes and bar
  charts extend the original component palette in all three systems.
- **Data-driven artifacts** — stable keyed repeats with independent local state,
  nested item scopes, safe arithmetic/comparisons, sorting and formatting.
- **Reusable compositions** — define document-local blocks with typed inputs and
  an optional typed public output, using the installed contracts.
- **Visuals, prose and forms** — declarative vector scenes, diagrams, line/scatter
  charts with accessible data tables, rich text, links, and native validated forms.
- **Projects & workspaces** — organize Kages into projects within a workspace
  (`workspace → project → Kage`), visible in the dashboard.
- **Share links** — publish a Kage and share an opaque `/k/<uuid>` link; anyone
  with it sees a clean full-page render in the Kage's own system.
- **Agents as first-class** — everything the UI can do is one operation over
  `POST /api/<op>`, so an MCP/REST/A2A agent can do it too (and vice versa).
- **Auth & multi-tenancy (optional)** — Google sign-in via Supabase, with an
  isolated per-user workspace seeded with intro templates on first login.

## Architecture

Four layers, each testable in isolation:

| Layer | What |
|-------|------|
| **engine** (`src/engine`) | Pure, framework-free: resolve · evaluate · validate · describe · catalog · generate. Golden-tested against the oracle. |
| **store** (`src/store`) | Artifactory: immutable signed versions (ed25519), provenance, lifecycle, RBAC, optimistic concurrency. |
| **adapters** (`src/adapters`) | One operation table → REST · MCP tools · A2A card · OpenAPI, all generated. |
| **runtime** (`src/runtime`) | React renderer driving the trusted design-system bundle with the engine. |

The behavioural spec lives as BDD feature files in `oracle/`. Reusable patterns
and conventions live as skills under `.claude/skills/` — see `AGENTS.md`.

## Running locally

```bash
npm ci
npm run dev        # http://localhost:3000 — no login, in-memory store (local mode; a built app needs KAGES_LOCAL_MODE=1)
npm test           # node:test suite
npm run typecheck
```

### Authoring notes

The Library's **New Kage** offers a blank canvas and complete starters, including
a searchable collection of reusable cards, a visual growth calculator and a
validated event form. A new Kage is created through `create_kage`; changes go
through `patch_kage` from the CLI, MCP or REST.

Complete examples live in `src/packs/examples.ts`; generated catalogs and packs
teach their contracts and expression syntax. Fresh workspaces include the
examples in the templates project. Existing workspaces can import the JSON
documents under `public/ds/` or create a starter with **New Kage**.

Repeats use `{each, key?, as?}`; choose a stable string or numeric item key to
preserve local state through filtering and sorting. Without `key`, identity
follows array position. `$item` reads the current row, `$index: ""` its position,
and `$scope: "alias.path"` a named outer row. Repeated references and commands
stay within their instance scope; use an unbounded container inside bounded
slots. Runtime expansion is capped at 10,000 blocks.

Compositions live in `doc.compositions[name]` with `inputs`, `root`, `blocks`,
optional `output` and `outputType`. Instantiate with a `composition` block and
`props.name` plus `props.inputs` or `bind.inputs`. Definitions read `$input`;
callers read `instance.value`. Both inputs and declared outputs are type checked.
Arithmetic uses finite numbers; invalid domains, overflow and division by zero
return null. Formatting is pinned to en-US and UTC. Forms emit named values as
strings or arrays of strings; numeric input change events emit numbers or null.

The generation envelope adds nullable `repeat_json` per block and
`compositions_json` per document. Legacy envelopes still parse; structured-output
clients should refresh their generation schema.

To regenerate artifact design-system assets, registries, oracle goldens,
integrity hashes and plugin packs, run `npm run build:ds` with `originals/`
available. Additive component sources live in `src/design-system/` and compile
into the reference oracle before inheritance; existing contract refs remain
unchanged. See `.claude/skills/free-flow-composition/SKILL.md`.

With **no environment variables set**, the app runs fully in-memory with no
login and a seeded demo — ideal for development.

## Persistence & auth (optional)

Both are **env-gated**: absent → the in-memory/no-login defaults above.

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Durable store (a JSON snapshot per workspace in Supabase). |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Enable Google sign-in + per-user workspaces. |

See `.env.example`. Database schema is versioned under `supabase/migrations/`.

## MCP & skills

Kages ships an MCP server so any MCP client (Claude Code, Codex, …) can author
Kages. It mirrors the one operation table onto MCP:

- **tools** — every operation (`create_kage`, `patch_kage`, `list_kages`, …);
- **prompts** — the per-system authoring **skills** (`kages-core`, `kages-ledger`,
  `kages-atelier`) — MCP has no skill primitive, so a prompt is its analog;
- **resources** — each system's component catalog and the agent card.

```bash
kages mcp                                   # run the stdio server
kages setup skills --harness claude --harness codex
```

`setup skills` installs the same skill packs where each harness loads them
(`~/.claude/skills/kages-<system>/SKILL.md`, `~/.codex/prompts/kages-<system>.md`)
and prints the one-liner to register the server (`claude mcp add kages -- kages mcp`).
Signed in (`kages auth login`) the server acts on your cloud workspace; otherwise
the local `./.kages`.

## Deploying

The app is a standard Next.js app and deploys to Vercel or any Node host. Set
the Supabase env vars in the project (or `DATABASE_URL` for plain Postgres; see
[deployment](docs/deployment.md)); run the migrations against your
Supabase project; enable the Google provider in Supabase Auth with a Google
Cloud OAuth client (redirect `https://<project>.supabase.co/auth/v1/callback`).

## Project layout

```
src/engine/     pure engine (resolve/evaluate/validate/describe/generate)
src/store/      artifactory: signed versions, provenance, RBAC
src/adapters/   one operation table → REST/MCP/A2A/OpenAPI
src/runtime/    React renderer + design-system bundle loader
src/app/        Next.js app: dashboard, library, /k share, /api, auth
src/server/     process store, Supabase persistence, identity
oracle/         BDD feature files — the behavioural spec
.claude/skills/ load-bearing patterns, captured as skills
```

## Review and runtime guarantees

Saved critiques require `fingerprint` from the reviewed `critique_kage` packet's `target.digest`. If the head changes, saving returns a conflict; refresh the evidence and review the new version. Never fetch a new digest solely to bypass that check.

Artifact code runs inside an opaque-origin sandbox. Host integrations cross a checked message port, and direct fetch is denied. New stored versions pin the renderer and design-system asset hashes; builds retain those immutable files. Legacy versions without asset pins use current assets. Google Fonts remain external resources.

Persistent storage fails closed on outages, initializes through compare-and-swap, and reloads committed state for reads. Public links check committed visibility, so an old public-share mirror cannot undo revocation. Apply the latest database migrations with `npm run db:setup`.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md)
first: it covers setup, the checks to run, and the few rules that do not bend
(the oracle wins; the engine stays pure; one operation table).
Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Report vulnerabilities privately; see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 focks. Design-system fonts (Bricolage Grotesque, DM Sans,
Fraunces, IBM Plex) are loaded from Google Fonts under their own open licenses and
are not bundled in this repository.
