---
name: kages-hooks
description: "The edit hook (`kages hook`) and its installer (`kages setup hooks`): what it checks, how each coding harness's payload is read and answered, config, and how to add a harness. Read before touching src/hooks or adding or changing a harness adapter."
---

# kages-hooks

Agents that write `*.kage.json` straight to disk get no feedback until someone runs
`kages validate`. `kages hook` is called by the harness after (or, for Claude, before) an edit:
it reads the payload on stdin, checks only Kage files, and answers in the harness's own shape.

## Contract (tested)
- **Invisible unless it has something to say**: always exit 0, nothing on stderr, silent on junk,
  oversize (1 MB payload, 2 MB file) or unreadable input. A pre-write *deny* is the only
  non-silent refusal, and only for content that cannot be a valid Kage (bad JSON, validator
  errors); lint never blocks.
- **Said once**: per-file cache in `.kages/cache/hook.json` (self-ignoring). A finding is
  reported when it first appears, not on every later edit; fixed then reintroduced is reported again.
- **Tiers**: per edit = validation errors + immediate rules (or all, `hook.perEditRules: all`);
  at Stop = the deep rules over every file edited this session, minus what was already said.
  Claude's Stop answers with `decision: block` once; `stop_hook_active` prevents a loop.
- **Safe paths**: realpath inside the project root, not under `node_modules`/`.git`/`dist`;
  a symlink out of the project is ignored.
- Output ≤ 8 lines and 2 KB. Config: `hook.enabled`, `hook.quiet`, `hook.perEditRules`,
  `lint.ignoreRules` (workspace `config.json`).

## Harness adapters are data (`src/hooks/harnesses.ts`)
Each has `detect`, `event`, `targets`, `addContext` (and optionally `proposed`, `deny`,
`continueTurn`) plus `docsUrl` and `lastVerified`. They were written from the official docs
(sources and date in `__fixtures__/README.md`), with a recorded payload per harness in
`__fixtures__/<harness>/`. **To add a harness: record its real payloads from its current
docs first**, add fixtures, then the entry, then its manifest in `manifest.ts`. Grok has no
verified format, so it has no adapter. Re-verify when `lastVerified` is old (`kages doctor`).

## Installing (`kages setup hooks`)
`planInstall`/`planUninstall` (pure, string → string) add or remove only entries whose command
contains `kages-hook`; everything else, indentation and trailing newline are preserved, and
uninstall restores the original byte for byte. The runner (`install.ts`) shows the diff, asks
(default yes; `--yes`; non-TTY without `--yes` writes nothing), refuses a malformed file
(`--force` backs it up as `.bak`, `.bak.1`, never over one), writes atomically keeping the
mode, and installs a launcher `.kages/bin/kages-hook` that exits silently if `kages` is not
installed. Claude and Codex ask the user to approve new hooks; the command prints that step.
