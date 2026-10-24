# Kages

**The cross-agent artifactory.** An artifact built in ChatGPT or Codex can't be
edited by Claude — each provider locks its artifacts to itself. Kages is the
neutral store in between: every agent, on any model or protocol, reads and writes
the same versioned, signed artifact through one operation set over MCP and REST.
Agents assemble it from **blocks** in a **design system** against published
**contracts** (they never write HTML), so the result is portable JSON with full
provenance — rendered live in the browser and shareable by link.

[![CI](https://github.com/focks/kages/actions/workflows/ci.yml/badge.svg)](https://github.com/focks/kages/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

🔗 **Live:** https://getkages.com · **App:** https://app.getkages.com · 📖 **Docs:** https://app.getkages.com/docs

## Quick start

Install the CLI from the hosted release and wire it to your agent (the command is `kages`):

```bash
npm install -g https://app.getkages.com/downloads/ifocksh-kages-0.2.0.tgz
kages --version
claude mcp add kages -- kages mcp    # or: codex mcp add kages -- kages mcp
```

Or run the app from a checkout (in-memory, no login):

```bash
git clone https://github.com/focks/kages.git && cd kages
nvm use            # Node 24 (22.18+ also works); see CONTRIBUTING.md
npm ci
npm run dev        # http://localhost:3000
```

Then drive it from the terminal:

```bash
node bin/kages.mjs help
node bin/kages.mjs validate public/ds/ops-console.kage.json
```

The CLI also builds from source with no hosted service involved:
`npm run build:cli` produces `dist/kages.mjs`. To run your own instance, see
[Deploying](#deploying).

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
  with it sees a clean full-page render in the Kage's own system. A whole project
  shares as one `/r/<uuid>` link that lists its published Kages.
- **Public gallery** — choose **Share → Publish to gallery** in the Library to make a Kage public and discoverable at `/gallery`. Anyone can browse; signed-in users can add or remove one upvote. Ordinary share links stay unlisted. The CLI supports `kages publish <name> --gallery` and `kages gallery list|upvote|unvote|remove`.
- **Agents as first-class** — everything the UI can do is one operation over
  `POST /api/<op>`, so an MCP/REST/A2A agent can do it too (and vice versa).
- **Auth & multi-tenancy (optional)** — Google sign-in via Supabase, with an
  isolated per-user workspace seeded with intro Kages on first login.

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
examples in the examples project. Existing workspaces can import the JSON
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

With **no environment variables set**, `npm run dev` runs fully in-memory with
no login and a seeded demo — ideal for development. A production build with no
auth configured is read-only instead (see below).

## Persistence & auth (optional)

Both are **env-gated** and independent: a database does not provide login, and
login does not provide a database.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Durable store on plain Postgres (wins over Supabase). Create it with `npm run db:setup`. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Durable store through Supabase (server-only; the key bypasses RLS). |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Google sign-in + per-user workspaces. Inlined at build time. |
| `KAGES_LOCAL_MODE=1` | Treat a built app like `npm run dev` (every caller is admin). Never on a shared host. |

Without auth, `npm run dev` is open and a built app is **read-only**: anonymous
writes get `401`, so a deployment that loses a variable fails closed. Data lives
in normalized `workspaces`, `kages` and `kage_versions` tables; the schema is
versioned under `supabase/migrations/`. Every variable is listed with
placeholders in `.env.example`.

## MCP & skills

Kages ships an MCP server so any MCP client (Claude Code, Codex, …) can author
Kages. It mirrors the one operation table onto MCP:

- **tools** — every operation (`create_kage`, `patch_kage`, `list_kages`, …);
- **prompts** — optional authoring guides and source-conversion workflows; tools
  also expose every guide so discovery does not depend on prompt support;
- **resources** — each system's component catalog and the agent card.

```bash
kages mcp                                   # run the stdio server
kages setup skills --harness claude --harness codex
```

`setup skills` installs the same skill packs where each harness loads them
(`~/.claude/skills/kages-<system>/SKILL.md`, `~/.agents/skills/kages-<system>/SKILL.md`)
and prints the one-liner to register the server (`claude mcp add kages -- kages mcp`).
Start with `/onboarding`: sign in, then run `kages auth login --url https://app.getkages.com` (or your own instance's URL) and `kages remote get_setup`. Workspace provisioning is automatic. From the connected agent call `get_setup`, then `get_context`; the latter includes the authoring skill and `get_authoring_guide` retrieves references without relying on prompts.

Signed in (`kages auth login`) the server acts on your cloud workspace; without login cloud creation is blocked. For intentional offline work use `kages mcp --local`. Local publishing has no hosted URL.

Source-conversion skills are installed with the authoring guides:

| Source | Skill |
| --- | --- |
| Markdown / README | `kages-markdown-to-kage` |
| CSV / TSV / JSON / spreadsheet | `kages-data-to-kage` |
| PDF / DOCX / plain-text document | `kages-document-to-kage` |
| Webpage / HTML export | `kages-web-to-kage` |

Retrieve a recipe with `get_authoring_guide` and its `name`. Binary formats need
an available extraction tool; these workflows preserve source meaning and require
content reconciliation and visual review before delivery.

Public viewers offer **Use this Kage → Copy as Markdown**, above Download and
Print. The copy contains readable content from the current app state, chart data
as tables, diagram nodes/relationships, source notes and code. All table rows and
expandable content are included; block visibility is respected. Presentation,
local pagination/zoom and interactive behavior stay in Kages. Clipboard denial
shows selectable text. “Are you an agent?” remains a separate header entry.

## Deploying

The app is a standard Next.js app and deploys to Vercel or any Node host. Choose
persistence (plain Postgres via `DATABASE_URL`, or Supabase), configure Supabase
Auth with Google, then `npm run build && npm start`. Without auth a built app is
read-only by design. The full self-hosting guide, including migrations, auth
redirects, build-time variables and pointing the CLI at your own instance, is in
[docs/deployment.md](docs/deployment.md).

## Project layout

```
src/engine/     pure engine (resolve/evaluate/validate/describe/generate)
src/store/      artifactory: signed versions, provenance, RBAC
src/adapters/   one operation table → REST/MCP/A2A/OpenAPI
src/runtime/    React renderer + design-system bundle loader
src/app/        Next.js app: dashboard, library, /k share, /api, auth
src/server/     process store, Postgres/Supabase persistence, identity
supabase/       database migrations (shared by Postgres and Supabase)
oracle/         BDD feature files — the behavioural spec
docs/           self-hosting guide and design notes
.claude/skills/ load-bearing patterns, captured as skills
```

## Review and runtime guarantees

Saved critiques require `fingerprint` from the reviewed `critique_kage` packet's `target.digest`. If the head changes, saving returns a conflict; refresh the evidence and review the new version. Never fetch a new digest solely to bypass that check.

Artifact code runs inside an opaque-origin sandbox. Host integrations cross a checked message port, and direct fetch is denied. New stored versions pin the renderer and design-system asset hashes; builds retain those immutable files. Legacy versions without asset pins use current assets. Google Fonts remain external resources.

Persistent storage fails closed on outages, initializes through compare-and-swap, and reloads committed state for reads. Public links check committed visibility, so an old public-share mirror cannot undo revocation. Apply the latest database migrations before starting a new release (`npm run db:setup` on plain Postgres, or `supabase db push`).

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
