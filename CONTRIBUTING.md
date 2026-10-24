# Contributing to Kages

Thanks for helping. Kages is small enough that one person can hold the whole
design in their head, and the rules below exist to keep it that way.

## Set up

You need **Node 24** (`nvm use` reads `.nvmrc`) or Node 22.18+ from the official
builds. Tests run TypeScript directly with Node's built-in type stripping; some
distro packages of Node 22 are built without it and fail with
`Unknown file extension ".ts"`.

```bash
git clone https://github.com/focks/kages.git && cd kages
npm ci
npm run dev          # http://localhost:3000, in-memory store, no login
```

With no environment variables the app runs fully in memory. Persistence (Postgres
or Supabase) and sign-in are optional; see `.env.example` and the
[deployment docs](docs/deployment.md).

## Before you open a pull request

```bash
npm run typecheck
npm test
npm run check:plugins   # generated plugin files are current
```

Generated files are committed, and CI fails if they drift. After you change a
design system, run `npm run build:ds` (it falls back to the tracked `reference/`
snapshot when `originals/` is absent) and commit what it produces.

## The rules that do not bend

1. **The oracle wins.** `oracle/*.feature` is the acceptance criteria, and the
   golden fixtures pin the reference behaviour. Add a golden or a scenario
   *before* adding behaviour.
2. **The engine stays pure.** `src/engine/` depends on nothing below it. A Kage is
   untrusted data: validated, never executed.
3. **One operation table.** REST, MCP, the CLI and OpenAPI are generated from
   `src/adapters/operations.ts`. Add an operation there once; do not add a
   second code path.
4. **The UI talks to the store only through `/api/<op>`.**
5. **Comment the why and the failure mode**, never the what.

The repo is written to be worked on with AI agents as well as by hand: the
load-bearing patterns live as skills in `.claude/skills/` and are indexed in
`AGENTS.md`. Read the relevant one before touching that area, and add a skill
when you find a pattern worth keeping.

## Tests

`node --test`, no framework. A test sits beside the code (`foo.ts` and
`foo.test.ts`), uses injected clocks and no network, and states the failure it
guards against in its name. See `.claude/skills/testing-conventions/SKILL.md`.
Security-relevant changes need a test that fails without the fix.

## Commits and pull requests

- Conventional style: `feat(store): ...`, `fix(cli): ...`, `docs: ...`.
- Keep a pull request to one change. Say what a reviewer should look at and how
  you verified it.
- Do not include secrets, personal paths or private data in code, fixtures or
  screenshots.

## Reporting problems

- Bugs and ideas: open an issue using the templates.
- **Security problems: do not open a public issue.** See [SECURITY.md](SECURITY.md).

By contributing you agree that your contribution is licensed under the
[MIT License](LICENSE) and that you will follow the [Code of Conduct](CODE_OF_CONDUCT.md).
