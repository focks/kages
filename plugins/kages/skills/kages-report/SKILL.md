---
name: kages-report
description: "The report form: a Kage that is read, not operated — findings first, evidence beside claims, everything static unless a control changes a real comparison. Read before building any status report, analysis, review or post-mortem Kage. One question answered is answer-pages; a long sourced case is research-briefs."
---

# Report Kages

A report is read top to bottom by someone who wants the findings, not a tour
of widgets. Treat it the way a design studio treats a client memo: real
typographic hierarchy, considered spacing, a proper palette — and nothing
that moves unless moving it answers a question. The form below carries the
same design philosophy as the web artifacts this repo's proposals ship as;
where that philosophy says CSS, this skill says blocks.

Make one only when asked for a report or write-up; a chat answer or raw
command output gets no Kage.

## The stance: static first

Interactivity is a cost — wiring, chrome, and a promise to the reader that
touching the thing does something worth doing. In a report that promise is
almost always broken. The default for every block is the resting state:

- Diagrams and charts stay static. The ladder in `kages-graph-interaction-levels`
  governs every climb, per graph, and "it would be cool" is not a rung.
- No accordions, tabs or modals *hiding evidence*. A reader skimming the
  resting page must meet every finding; collapse only what is genuinely
  optional detail (raw logs, full tables already summarized in view).
- A control earns its place only when it changes a real comparison the
  report itself makes — a scenario toggle that re-filters the same chart, an
  audience choice that re-emphasises sections (never silently hides their
  evidence). One such control per report is usually the honest maximum.
- A stepper is for content that *is* a sequence. Numbered markers on
  non-sequential sections are decoration, and decoration lies.

The test: print the resting render to a PNG. If the report still does its
whole job, the interaction budget was spent right.

## The shape

1. **Findings first.** The reader who stops after one screen leaves
   correctly informed. Open with a `section` (level 1) stating what the
   report found in two or three plain sentences — `scale:hero` with a
   `palette` and `backdrop:wash` only when the report carries a verdict
   worth that weight; most status reports open at standard scale.
2. **A facts row** under it: three to five `stat` tiles of load-bearing
   context (period covered, scale, today's state). Big-number tiles only
   when those numbers are the point; captions in sentences.
3. **One section per topic**, level 2, heading phrased as what the section
   establishes. Inside: the claim in prose, then its evidence — `table`,
   chart, `diagram`, `code` — *beside* the claim, never three screens away.
   Say what each evidence block shows and where it came from. `code`,
   `diagram` and `image` have a `caption` prop; charts use `takeaway` and
   `source`; a `table` has neither, so follow it with `text` at
   `variant:"caption"`.
4. **Closed vocabularies in cells.** A comparison or status matrix uses a
   small fixed vocabulary (yes / partly / no, ok / degraded / down) plus a
   legend line, with conditions spelled out — an honest "partly — needs an
   index" beats a generous "yes". Tone maps by role (`success`/`danger`
   mean state, the accent means emphasis; never swap them).
5. **Verbatim things stay verbatim.** Quoted errors, session transcripts
   and log lines go in `code` blocks marked as verbatim in the caption.
   Paraphrase in prose, quote in evidence.
6. **Computed figures over hand-typed ones.** Bind totals to `$count`/
   `$sum` over `data` so a changed row cannot leave a stale sum. Follow
   `kages-coherent-presentation` for chart colors, takeaways and freshness:
   a timestamp typed into the page is not freshness.
7. **Sources last, honesty in the footer.** Pin code claims `file:line` at
   a commit in a `references` block (mechanics in `kages-research-briefs`). Close
   with `text` at `variant:"caption"` stating what was abstracted away, what is illustrative,
   and what evidence is missing. A report that hides its gaps is wrong even
   where its findings are right.

## Treatment

Reports get the utilitarian treatment: polished, not decorated.

- **Reading width.** `page` at `width:reading`; wide only when the evidence
  is genuinely wide, and then the wide block scrolls inside its own rail
  (tables and code already do this) rather than stretching the prose.
- **One palette family, used by role.** Pick one section `palette` and
  reuse it only for regions carrying the same role (the opening finding and
  the closing recommendation, say), so colour keeps meaning down the page.
  Everything between stays plain or `surface`. Semantic tones are not the
  accent.
- **Structure is information.** Eyebrows are true kickers ("Proposal ·
  Discovery", "Q3 · Infrastructure"), levels nest honestly (1 → 2 → 3, no
  skips), dividers separate topics that are actually separate. A device
  that encodes nothing true about the content comes out.
- **Write like a person who knows.** Active voice, specific over clever,
  controls and headings state exactly what they are. No filler ("worth
  noting"), no hedging the evidence doesn't force.

## The gate

Validate, lint, and screenshot at 390 and 1200 plus dark before sharing
(`kages-visual-review`). Read the render — checks pass pages that are visibly
wrong, so look for clipped labels, walls of unbroken prose, and literal
artifacts like "[object Object]". Mention a check in the hand-off only when
one failed or a warning stands.

## Reaching for a sibling instead

| The job | The skill |
| --- | --- |
| Answer one question with a verdict | `kages-answer-pages` |
| Make a long, sourced case with citations | `kages-research-briefs` |
| A designed chart-dense canvas report | `kages-coherent-presentation` |
| Decide whether one graph may be interactive | `kages-graph-interaction-levels` |
| A chaptered handbook someone returns to | `kages-field-guides` |
