---
name: kages-cli
description: "The `kages` command-line tool — how it is structured and how to extend it. One CLI, grouped into toolsets (learn / author / manage / dev), that is a thin translation of the operation table plus the pure engine for offline work. Covers the offline-vs-store split, the file-backed workspace (./.kages) and its persistence, and the rule that a new capability becomes an operation first. Read before adding or changing a CLI command or the workspace store."
---

# kages-cli

`kages` is the command-line adapter. Like every adapter it is a **thin
translation of the one operation set** (`src/adapters/operations.ts`) plus the
**pure engine** for offline work — it holds no business logic. Entry is
`bin/kages.mjs` → `src/cli/kages.ts`; `package.json` `bin` maps `kages` to it.

## Toolsets (the command groups)

| Group | Commands | Backend |
| --- | --- | --- |
| **learn** | `systems` · `catalog <sys>` · `contract <ref>` · `schema <sys>` | engine data (offline) |
| **author** | `validate` · `describe` · `preview` · `convert` | pure engine (offline) |
| **manage** | `init` · `create` · `patch` · `ls` · `get` · `versions` · `search` · `publish` · `export` · `state` · `comment` | the workspace store |
| **dev** | `pack <sys>` · `openapi` · `agent-card` · `mcp-tools` | generated surfaces |

Global flags: `--json` (raw output for scripts/agents), `-s/--system`,
`-C/--workspace`, `-o/--out`, `-v/--version`, `-h/--help`.

## Offline vs store — the split that matters

- **Offline commands** call the engine directly (`validate`, `describe`,
  `catalog`, `generationSchema`, a `KageSession` for `preview`). They need no
  store and no server — `kages validate file.kage.json` works anywhere. This is
  the SDK/CLI "offline validate()/describe()" the spec promises.
- **Manage commands** load a **persistent workspace store**, dispatch the
  matching operation, and `saveStore` only if the op mutated and succeeded.

`author` commands take **a file path OR a stored name** (`resolveDoc`): if the
argument is an existing file it is read; otherwise it is looked up in the
workspace. Keep that dual behaviour when adding file-oriented commands.

## The workspace (local artifactory)

`src/cli/workspace.ts` persists the in-memory `Store` to
`<workspace>/store.json` (default `./.kages`, override `-C` / `$KAGES_HOME`).
It is the "persistent backend behind the same interface" the architecture
describes:

- `Store.snapshot()` / `Store.restore()` serialize versions (with provenance +
  signatures), grants, **signer keys** (exported as PEM via `crypto.exportKey`),
  audit, events and comments. Keys travel with the snapshot so digests stay
  verifiable across runs.
- **Claims and the quota window are deliberately NOT persisted** — a lease that
  survived a reload would be a crashed agent holding a Kage hostage, the exact
  thing TTLs prevent.
- The local `owner()` is `user:<login>`, granted full rights on `kages`, so
  provenance is real and commands just work.

A private key on disk is a genuine trust assumption — fine for a local
workspace, wrong for a shared server (that uses a KMS/HSM behind the same API).

## Adding a command — the rule

A new capability becomes an **operation first** (`src/adapters/operations.ts`),
then a one-line CLI case that dispatches it. It then exists in REST/MCP/A2A/
OpenAPI too, for free (`how-to-extend-kages`, `dashboard-over-adapters`). Only
genuinely engine-pure, file-level work (lint/convert/format a local document)
may call the engine directly without an operation.

Output: human tables/`kv` by default (`src/cli/format.ts`), `--json` for the raw
op result. Exit `1` on any operation error or validation failure; `0` otherwise.
Tests live in `src/cli/kages.test.ts` — capture stdout, assert exit codes, and
drive a temp `--workspace` to prove persistence.


## Discussion commands

`comment <name> <block|-> <text> [--at x,y]` (`-` = about the whole Kage; `--at`
pins inside the block), `comments <name>` (indented thread with scores),
`reply <name> <comment-id> <text>`, `resolve <comment-id> [--reopen]`,
`vote <comment-id> up|down|clear`. Each is a thin translation of the matching
operation; the rules are the store's (see `discussion-comments`).

## Authoring and review commands

`from-markdown <file.md> [--create]` writes a Kage from prose (see `outline_to_kage`);
`validate` prints a fix for every finding and lint for pitfalls the validator allows;
`screenshot <file|name> [--width 390,1200] [--dark] [--strict]` renders it (see
`visual-review`). Boolean flags that must never swallow the next argument are listed
in `BOOLEAN` in `src/cli/args.ts` (`--dark`, `--no-sandbox`, `--create`, `--reopen`).

## Configuration (`src/config/`, `kages config`)

Layers, lowest to highest: defaults < user `~/.kages/config.json` < workspace
`<workspace>/config.json` (tracked, team policy) < `config.local.json` (ignored,
this machine) < `KAGES_*` env < flags. `loadConfig` is pure over an injected
reader, never throws on the read path, and drops keys of the wrong type instead
of half-applying them. Secrets (`session`, `anonKey`) live only in the user file;
a workspace file containing one is refused and ignored. `kages config set` routes
`localOnly` keys (`screenshot.chrome`, `hook.consent`, `advice.auditLog`) to the
local file; unknown keys are preserved on write. To add a setting: add it to
`KEYS` in `src/config/schema.ts` (type, `localOnly`, description), an `ENV_MAP`
entry if it needs one, and a test.

## `kages init`

`src/cli/init/`: `scan.ts` (pure, over an injected `FsLike`; every read bounded, README
text is untrusted), `interview.ts` (an `Io` interface: `ttyIo`, `ScriptedIo`; ≤ 3 questions
a round, never about visual style), `index.ts` (`runInit`, the orchestration). Anything the
scan supplies stays in the brief's `inferred` list until a person types or confirms it, so
`get_context` keeps raising `BRIEF_UNCONFIRMED`. Non-TTY without `--answers` writes no brief
and exits 0; the first output line (`initialized workspace at …`) is relied on by scripts.
`init` prints, and does not run, the harness setup commands: installing skills or hooks is
the installer's job.

## Advice on write, and the audit log

Successful `create_kage` / `patch_kage` / `generate_kage` / `set_kage_brief` responses carry
`advice` (what that write introduced), `ack: "clean"`, and `resolved`/`existing` counts.
Policy (`src/engine/regressions.ts`): `full` (agents; the default), `quiet` (floor
`advice.minSeverity`, default P2, nothing when clean; the CLI default at a terminal or with
`advice.quiet`), `off`; a request's `advice`/`minSeverity`/`all` beat the context default
(`OpContext.advicePolicy`). A refused write is never quieted. Matching is by rule and block,
so a reworded finding is not "new".

`advice.auditLog` (config, local-only) or `KAGES_ADVICE_LOG` turns on one NDJSON line per
advice/lint call: counts, rule ids, timings, never text (`entryFor` has no field to put text
in, and a sentinel test checks it). `advice.logBlockIds` adds block ids. Rotates at 5 MB
(3 kept). On a hosted server only `KAGES_ADVICE_LOG=stdout` is honoured. Read it with
`kages advice-log stats|tail`; a rule with a high waiver rate is a false-positive candidate.

## `kages report` (diagnostic bundle)
`src/report/redact.ts` (pure, patterned, applied twice), `bundle.ts` (typed `ReportInput` in, markdown out; the
type is the allow-list), `src/cli/report-cmd.ts` (collectors and every effect injected). **Nothing is ever sent**:
stdout by default, `--out` writes mode 0600 and refuses to overwrite without `--force`, `--open` needs a TTY and a
y/N and pre-fills only a title and an environment line. Env is booleans, config is keys and layers (values only with
`--include-config-values`, and secret names stay hidden anyway), a Kage is codes and places (never messages), and the
document is included only with `--include-doc` after a confirm, truncated to 50 KB. When you add a field to
`ReportInput`, add its sentinel to the `sentinel run` test in `src/report/report.test.ts`, and add near-misses to the
redaction corpus when you add a pattern: over-redacting a commit SHA is a bug too.

## `kages push` (local store → running app)
The CLI store (`./.kages`) and the app's store are separate by design, so `push` (`src/cli/push-cmd.ts`) carries a Kage
across over the same REST ops: `create_kage`, or `patch_kage` with `--replace` (top-level ops only, never delete, key
order and server stamps such as `resolved` ignored, so a second push is "already up to date"). Server from `--server`,
`KAGES_SERVER`, else `http://localhost:3000`; bearer only when `--token`/`KAGES_TOKEN` is given. Always check a new
server-stamped field against `replaceOps`, or every push will report a change.

## Guest feedback on shared links
`Store.addGuestComment(uuid, {name,text,block?})` (src/store/store.ts) is the only way a `guest:<name>` principal writes:
only on a head that anonymous readers can already open, one root comment, a separate 50-per-Kage quota, and
`commenter()` treats guests as not real everywhere else (so the view never advertises an edit it would refuse).
`POST /api/shared/<uuid>/feedback` resolves the owning workspace (`getPublicShareWorkspace`) and writes through
`mutateStore`; the panel is `src/components/dashboard/share-feedback.tsx`. `kages push --publish` defaults to link visibility.
