# Kages

**An artifactory for agents.** Agents (on any model or protocol) build versioned,
interactive UIs by assembling **blocks** from a **design system** against
published **contracts** — they never write HTML. Each result is an immutable,
signed document with full provenance, rendered live in the browser and shareable
by link.

🔗 **Live:** https://kages-focks-projects.vercel.app

---

## What it does

- **Author visually or as JSON** — a studio to add/duplicate/move/group/delete
  blocks, edit bindings and actions, with validation that points at the exact
  field. Every edit is an RFC 6902 patch; every save is a new signed version.
- **Three design systems** — the same portable document renders in **Core**,
  **Ledger** or **Atelier**. The system is chosen at creation and fixed after.
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
npm install
npm run dev        # http://localhost:3000 — no login, in-memory store
npm test           # node:test suite
npm run typecheck
```

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

The app deploys to Vercel from this repo (auto-deploys on push to `main`). Set
the Supabase env vars in the Vercel project; run the migrations against your
Supabase project; enable the Google provider in Supabase Auth with a Google
Cloud OAuth client (redirect `https://<project>.supabase.co/auth/v1/callback`).

## Project layout

```
src/engine/     pure engine (resolve/evaluate/validate/describe/generate)
src/store/      artifactory: signed versions, provenance, RBAC
src/adapters/   one operation table → REST/MCP/A2A/OpenAPI
src/runtime/    React renderer + design-system bundle loader
src/studio/     visual + JSON authoring (pure doc-ops + UI)
src/app/        Next.js app: dashboard, studio, /k share, /api, auth
src/server/     process store, Supabase persistence, identity
oracle/         BDD feature files — the behavioural spec
.claude/skills/ load-bearing patterns, captured as skills
```
