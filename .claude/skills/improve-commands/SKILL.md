---
name: improve-commands
description: "The named improvement moves (critique, polish, distill, harden, clarify, onboard, adapt, quieter, bolder): where the playbooks live, how they are linted, how the packet, MCP prompts, slash commands and plugin files are generated. Read before adding or editing a playbook or a command."
---

# improve-commands

A move is a **name an agent and a person can share** ("polish the pricing page"), backed by a
playbook of original text. Kages runs none of them: `kages improve <command> [kage]` and the
`get_improve_packet` op assemble the playbook plus context (`get_context` text, open critique
backlog, top lint findings, trimmed described view, ≤ 10 KB, authored text fenced) and the agent
follows it. Judgement stays with the agent; deterministic parts are ops (`tune_kage`, `lint_kage`,
`validate_patch`, `critique_kage`).

- **Source**: `src/packs/commands/playbooks.ts` (text), `commands.ts` (category, description, ops,
  next), names in `src/engine/improve.ts` (storage validates a critique's suggested command against
  them). All seven sections are required, in order: Purpose, Before you start, Scope, Steps,
  Verification, Done when, Hand off to.
- **Bounded verification** is the rule every playbook states: build or fix fully, look once in one
  batched round (phone and desktop together), fix everything, confirm at most once, stop.
- **The linter** (`lint.ts`, run by `commands.test.ts`) fails on a wrong heading set, > 4096
  characters, TODO/placeholder text, a backticked op that does not exist, a `kages <verb>` that is
  not a CLI case, an unknown hand-off, or metadata that disagrees with the text. The hand-off graph
  must stay connected from `critique`.
- **Generated** by `npm run build:plugin`: `plugins/kages/skills/kages-improve/` (index +
  `reference/<command>.md`), `plugins/kages/commands/kages-improve-<command>.md` (slash commands),
  MCP prompts `kages-improve-<command>` (argument `target`, sanitised), `COMMANDS` in the CLI. The
  test compares committed files to the generator.
- **Adding a move**: a name in `IMPROVE_COMMANDS`, metadata, playbook, a hand-off from some other
  move, and the capability it depends on must already exist (name it in `ops`). Moves that need
  capabilities Kages lacks (colour, type, motion, performance) are listed as *Planned* in the
  generated index, not shipped.
