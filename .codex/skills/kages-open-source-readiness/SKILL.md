---
name: kages-open-source-readiness
description: Review and improve Kages public-release readiness, contributor setup, packaging, release checks, and publication hygiene. Use for readiness reviews or changes to those areas; ordinary feature work does not require a full publication audit.
---

# Kages open-source readiness

Make Kages usable from a fresh public checkout without the maintainer's machine,
accounts, or private reference files. For a review, deliver evidence and prioritized
findings. For an implementation request, fix the authorized scope and verify it.
Writing this skill or reviewing readiness does not itself publish anything.

## Establish the current state

Read `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`,
`package.json`, `.gitignore`, `.env.example`, and the relevant workflows in
`.github/workflows/`. Check the current checkout; do not carry old findings or
test counts forward as facts.

Use `git status --short`, `git ls-files`, and `git check-ignore` to distinguish
tracked source, ignored local files, and untracked files that could be staged.
Reviewing an untracked file does not authorize adding or deleting it.

## Make the contributor path reproducible

- Resolve local documentation links and compare documented npm commands with
  `package.json`. Fix broken instructions at their source; avoid adding empty
  scripts merely to satisfy stale prose.
- Distinguish source-checkout requirements from the bundled CLI's supported Node
  versions. Read `.nvmrc`, `engines`, build scripts, and CI before changing them.
- Verify a fresh checkout can use the tracked `reference/` fallback without
  `originals/`. Keep the oracle and engine invariants in
  [kages-architecture](../../../.claude/skills/kages-architecture/SKILL.md).
- Keep local setup independent of hosted sign-in. Explain explicit offline CLI
  use separately from hosted login; cloud defaults must not obscure the local path.
- Inspect npm's `files` allowlist and a package dry run when changing packaging.
  A local `.env` being ignored by Git does not prove an archive excludes it.
  Follow [kages-distribution](../../../.claude/skills/kages-distribution/SKILL.md)
  for the CLI bundle, versioning, plugins, and generated artifacts.
- Keep license, contribution, security-reporting, and release instructions
  consistent with what the project actually provides. Flag unverified ownership
  or third-party licensing rather than inventing permissions.

## Keep operational data out of published source

Use [kages-deployment-boundaries](../kages-deployment-boundaries/SKILL.md) to
classify deployment files. Check backups, admin/browser captures, connection
strings, environment exports, and archive contents when publication hygiene is
in scope. Report paths and secret categories without printing credential values.
Use synthetic or redacted data in new fixtures and examples.

For a request to assess whether the repository is safe to make public, include
history and release assets in the review when tools and scope permit. Otherwise
state that those areas are unverified. A clean current tree or `.gitignore` entry
does not remove an earlier committed credential. Identify any exposure and the
need to rotate it; changing credentials or rewriting history remains a separate
action governed by the user's existing authorization.

## Verify and report with evidence

Scale checks to the change. Documentation-only edits need working links and
commands checked against their definitions. Code and packaging changes need the
relevant tests, typecheck, build, package, or generated-file checks. Derive commands
from the current scripts; do not assume a docs generator exists.

For a broad readiness review, run the available typecheck and test suite and
assess production-build and clean-checkout reproducibility. Use a disposable
checkout or temporary output for checks that regenerate files. Do not use the
developer's configured production database or authenticated cloud workspace for
verification. Distinguish local checks from unobserved CI results.

Report blockers before optional improvements, with file references, observed
failures, and checks not run. A skipped integration test is not a pass. Reproduce
a failing check when useful, and do not call the project fully ready while
material failures remain unexplained. Preserve unrelated working-tree changes.

## Shared source

Maintain these instructions here. The matching
[Claude entrypoint](../../../.claude/skills/kages-open-source-readiness/SKILL.md)
only routes to this file; update both discovery descriptions if the scope changes.
