---
name: kages-distribution
description: "How Kages ships: the single-file CLI bundle (dist/kages.mjs), `kages install | update | check | uninstall`, the install manifest, and the generated plugin artifacts for Claude Code and Cursor. Read before changing packaging, the installer or src/plugin."
---

# kages-distribution

## One version, one bundle
`package.json` `version` is the only version (`src/version.ts` reads it; the plugin generator,
marketplace entry, installed-file stamps and `kages --version` all come from it). Source
checkouts run TypeScript (`bin/kages.mjs`, Node ≥ 22.18). **What is published is
`dist/kages.mjs`**: `npm run build:cli` (also `prepare`) bundles `src/cli/bin.ts` with esbuild into
plain ESM for Node 18+, with `pg` external. `install.test.ts` packs the tarball, unpacks it,
and runs it with `--no-experimental-strip-types`; that is the regression guard for "the CLI
needs TypeScript support". Anything that must work for a user (not a contributor) must be
reachable from that bundle; do not import `@/` or React from `src/cli` or `src/install`.
`"private": true` stays until the owner decides to publish; `.github/workflows/*.yml` are
suggestions until committed.

## `kages install`
`src/install/`: `files.ts` (pure: which files for which provider and scope, generated from the
packs), `run.ts` (detect → plan → consent → write → manifest). Skills, slash commands and agents
are written for Claude (project `.claude/` or `~/.claude/`); Codex gets prompts in `~/.codex/prompts`
only (project scope says why nothing is written); hooks go through `setupHooks`; the MCP server is
printed, or `--mcp write` merges it into `.mcp.json` (never over an invalid file). The manifest
`.kages/install.json` records `{version, scope, providers, hooks, files:[{path, sha256}]}` and is the
only thing `update`, `check` and `uninstall` act on. A file whose hash differs from the manifest
was edited by hand: it is kept (`--force` overwrites). `check` exits 1 when not installed, a file
is missing or the version is older; a hand edit is reported but not failing. Offline always.
Signed remote updates are not built: `update` re-runs install at the installed CLI's version,
and a newer one comes from rebuilding the checkout (the package is not on npm yet).

## Plugins (`src/plugin/generate.ts`)
`generatePlugins()` returns every file of every target as a path → content map; `npm run build:plugins`
writes it, `npm run check:plugins` (and a test) compares it with disk. Targets: Claude Code
(`plugins/kages`: manifest, MCP, skills, commands, agents, `hooks/hooks.json`, launcher) and
Cursor (`plugins/kages-cursor`). Private deployments: `KAGES_PLUGIN_MCP_URL`. **Add a target only after
its current official plugin format is read from its docs** and a validator exists in `validateTarget`
(VS Code, Codex and Grok are listed as planned). The Claude target is also checked with
`claude plugin validate --strict` when that CLI is installed.

## Interop and packs
- `src/interop/json-render.ts`: both directions with Vercel's json-render (flat `{root, elements, state}`, shadcn
  catalog). Every conversion returns `notes`; a silent substitution is the failure to avoid. Formats were read from the
  json-render repo on 2026-10-16: re-check `packages/core/src/types.ts` and `packages/shadcn/src/catalog.ts` when it
  releases, and update `REQUIRED` in the file with the catalog. Ops `from_json_render` / `to_json_render`; CLI `kages json-render`.
- `src/packs/decision-guide.ts` + `decision-guide-examples.ts` + `decision-skill.ts`: the Technical Decision Pack. The
  intake is the contract; add a subject as an intake, never as a hand-built page, and add it to `EXAMPLES` so the tests
  exercise it. The skill text feeds both `kages install` and the generated plugins.
- `src/pilot/funnel.ts` + `pilot/PROTOCOL.md`: pilot numbers derived from the participant's own store (counts and days only,
  asserted free of titles/text/names). Add a measure only if it stays content-free; thresholds live in `summarize`.
- Guided first use: `/docs/build-a-guide` (a docs lesson, not an app nav item: `src/app/docs/build-a-guide`, component `src/components/dashboard/guide/guide-builder.tsx`; `/guide` redirects; model in `src/components/dashboard/guide/guide-model.ts`) builds through the
  same ops an agent uses; the example's facts stay marked unverified however the person renames it.
