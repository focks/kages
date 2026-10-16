---
name: kages-doctor
description: "`kages doctor`: the drift report across config, brief, store, hooks, git ignore block, skills, critiques, deprecations, the design-system bundle and the environment. Covers the severity classes, how to add a check, what --fix may touch, and the cheap subset `kages context` uses. Read before adding a check or changing what doctor repairs."
---

# kages-doctor

Reports drift between the files Kages writes and what this version reads, and names the command
that fixes each finding. **It never repairs anything as a side effect** of another task; `--fix`
applies only findings marked `fix.safe` (today: rewriting the managed `.gitignore` block, pruning
rows that refer to deleted Kages), and a second `--fix` is empty.

Severity: `auto` = the next ordinary write fixes it anyway; `mention` = worth knowing; `route` =
run the named command. `--strict` makes route findings exit 1; `--json` is stable (`version: 1`).

## Adding a check
A check is `(ctx) => DoctorFinding[]` in `src/doctor/checks.ts` over `DoctorCtx` (injected `fs`,
`now`, `config`, `store`, `env`, `git`, `home`): no I/O of its own, so a fixture proves it. Give it a
stable kebab id, a severity, an `area`, a message that names the file, and a `fix.command`. Add it
to the seeded-corruption test in `doctor.test.ts`; a fresh `kages init` workspace must stay at
zero findings. Never echo a secret (the database URL is not shown; a credential is named, not
printed). Network checks run only with `--online` (`ctx.ping`). A finding id can be silenced with
config `doctor.ignore`.

## Checks (v1)
config-invalid-json, config-secret-in-tracked, config-unknown-key · brief-store-mismatch,
brief-unconfirmed · store-legacy-snapshot, store-unreadable, store-orphans, store-size ·
hooks-missing, hooks-stale, hooks-launcher-missing, hooks-schema-old · gitignore-block-missing,
gitignore-block-drift, tracked-runtime-file · skills-stale · critique-stale, critique-open-p0 ·
deprecated-used · bundle-drift (dev checkouts) · env-node, env-db-unreachable.

`doctorLite` (config, gitignore, hooks, bundle; file stats only) feeds a `CONTEXT_STALE`
directive in `kages context`; it only reports.
