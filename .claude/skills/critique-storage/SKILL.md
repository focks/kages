---
name: critique-storage
description: "Design critiques in Kages: the evidence packet (critique_kage), the rubric and protocol in src/packs, saved results with trend and staleness (save_critique, src/store/critique.ts), the isolated sub-agents, and the Library tab. Read before changing the rubric, the packet, critique storage or anything that reads a saved critique."
---

# critique-storage

**Kages calls no model.** `critique_kage` returns evidence (validation, findings, stats, a
fenced `describe`, briefs, optional render facts) plus the rubric and protocol; an agent scores;
`save_critique` stores. Keep it that way: anything needing judgement is a playbook an agent
follows, anything deterministic is code with a test.

- **One source** for the rubric: `src/packs/rubric.ts` (ten heuristics, anchors 0–4, Kages
  signals, personas, severity). The packet, `PROTOCOL`, the sub-agent bodies and the Library
  all read it; changing wording there changes them all. Bump `RUBRIC.version` if scoring
  meaning changes, because old critiques were scored against the old text.
- **Isolation is a tool list.** `kages-critic` (`src/packs/agents.ts`) may not call any op in
  `FINDING_OPS`; a test fails if it can. Regenerate the plugin files with `npm run build:plugin`.
- **Storage** (`src/store/critique.ts`, `Collection` in the snapshot): totals and counts are
  recomputed on save; a null score needs a reason; ≥ 3 heuristics scored; `command` must be an
  improve command (`src/engine/improve.ts`); `block` must exist in the judged version.
  Fingerprint = head digest; stale = digest differs now. 20 saves/hour/principal; 50 per Kage,
  closed ones evicted first; deleted with the Kage.
- **`close_critique` closes one id**, the one the polish pass worked from, never "the latest".
- **Trend** is the last five, oldest first; differing maxima are printed per score and flagged
  not like-for-like.
- **UI**: pure `critique-model.ts` (chip, banners, backlog order), `CritiqueTab`. The report
  body is untrusted and rendered as plain text.

## Tune (`src/engine/tune.ts`, `kages tune`)

A deterministic bolder/quieter step over declared ladders, the refinement a critique usually
asks for. To add a knob: add the prop to the ladders at the top of the file, the rule in the
`quieter` or `bolder` branch (respect `hierarchyOnly` for read/operate), the prop to `loudness()`
with a weight so the monotonic test sees it, and the prop name to `KNOB_PROPS` in the test. The
property test runs every shipped example × 3 systems × both directions × amounts 1–3 and checks
validity, byte-identical non-knob content, monotonic loudness and convergence; the golden file
`src/engine/__fixtures__/tune-golden.json` pins three documents (`UPDATE_GOLDEN=1` to refresh).
Bound props are never patched (they are computed); a tune on a bound prop is reported as skipped.
