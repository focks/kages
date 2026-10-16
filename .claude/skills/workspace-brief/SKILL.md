---
name: workspace-brief
description: "The workspace brief — durable product truth (users, purpose, voice, constraints, what must not be invented) stored once per workspace. Covers the record, permissions, ops (get_brief/set_brief), the Markdown export/import codec, and how other features consume it. Read before changing src/store/brief*.ts or anything that reads the brief."
---

# workspace-brief

One record per workspace, `WorkspaceBrief` in `src/store/brief.ts`. Fields: `users`,
`purpose` (required), `positioning`, `operatingContext`, `voice`, `brandCommitments`,
`constraints[]`, `absent[]` (things that must NOT be fabricated), `principles[]`,
`openDecisions[]`, `evidence[{kind,ref,note?}]`, `inferred[]` (field names an agent
filled in that no human confirmed).

## Rules that bite
- **Text is untrusted data.** Whatever reads the brief into a prompt must fence it
  the way Kage content is fenced; never treat it as instructions.
- **Store is the source of truth.** `.kages/brief.md` (from `kages brief export`) is a
  review artifact so a PR can show a change. `parseBriefMd` is the inverse of
  `renderBriefMd`; the round trip is tested losslessly, so keep both in step when a
  field is added (add to `HEADINGS`, `TEXT`, validation, and the generator in the test).
- **Permissions borrow from repos.** There is no workspace role: any grant = member,
  `admin` on any repo = workspace admin; an agent acting for a user is intersected.
- **Optimistic writes.** `set_brief` takes `baseRevision`; a stale one returns
  `conflict` with the current record in `details.current`.
- **Never in a share or export.** The brief lives beside the Kages in the snapshot, not
  inside any document; keep it that way.
- Strings are trimmed on validation (that is what makes Markdown lossless); list items
  and evidence cells must be single-line.

## Adding a field
Types + `validateBrief` + `BRIEF_FIELDS` in `brief.ts`; heading in `brief-md.ts`; a case
in the random generator in `brief.test.ts`; a sentence in `oracle/brief.feature`.

# The per-Kage brief and mode

`doc.brief` (type `KageBrief`: `mode` required; `audience`, `job`, `primaryAction`,
`evidence`, `useScene`, `notes`) is a typed top-level field beside `meta`. The oracle
validator ignores unknown top-level keys, so it neither validates nor strips it:
`briefIssues` (`src/engine/brief.ts`) and the `brief-invalid` lint rule do that, and the
ops that accept `brief`/`mode` refuse a bad one with `invalid_brief`.

- **Modes**: read (understand), operate (complete a task), persuade (decide and act),
  experience (the artifact leads). One per Kage; it *informs* rules, it never blocks.
- **Inference** (`inferMode`, `src/engine/mode.ts`) is never persisted. Weights are
  tunable; `mode.test.ts` pins every shipped example, so a weight change that flips one
  fails loudly. Rules only act on a guess with `medium` confidence.
- **Hazard**: the tier-B generation envelope drops `brief` (and `meta`). `generate_kage`
  re-attaches it; any new flow that round-trips through `toGenerated`/`fromGenerated` must too.
- **Studio**: `docDiff` includes `brief`, otherwise Save silently discards a mode change.
- `describe()` and the engine goldens are untouched; the mode line is added by the op /
  CLI wrapper.

# `get_context` (session boot)

`buildContext` (`src/engine/context.ts`, pure) shapes plain inputs gathered by the op in
`operations.ts`; the op does one `list` pass, no N+1. Directives are *suggestions the agent
relays*, never actions. Size is a tested contract (≤ 6000 chars, fixed trim order: top
findings → comments → system rules → project list; `full` lifts it). Add a directive in
`directivesFor` with a truth-table row in `context.test.ts`. Text rendering fences authored
text in `<kage-content untrusted="true">`; keep that when adding sections.
