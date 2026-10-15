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
