---
name: kages-answer-pages
description: "The one-page answer: a Kage that answers a specific question with the conclusion first, one section per sub-question, evidence blocks beside the claims they support, and a decisions table with suggested defaults. Read before building a Kage whose job is to answer a question or support a decision. Long sourced reports are research-briefs; this is the short form."
---

# Answer pages

When someone asks a question — "should we isolate users?", "which queue do we
pick?" — the page that answers it is its own form, distinct from a report. The
reader came for a verdict, not a tour. (Form adapted from Archify's explainers;
citations and sourcing follow `kages-research-briefs`.)

Make one only when asked for a page or a write-up; a chat answer, a one-liner
or raw command output gets no Kage.

## The shape

1. **The short answer first, inside a hero.** Open with a `section` at
   `scale:hero`, `level:1`, a meaningful `palette` and `backdrop:wash`, and put
   the verdict card *inside it*: two or three sentences, plain words, no
   hedging the body doesn't justify. A reader who stops here leaves correctly
   informed. Reuse that palette only for sections that carry the same role, so
   color keeps meaning down the page.
2. **A facts row** under it: three to five label-value pairs of load-bearing
   context (who, scale, today's state) as `stat` or `badge` rows.
3. **One section per sub-question**, each heading phrased as the question it
   answers ("What is shared today", "What does each level stop"). Inside: the
   claim in prose, then the evidence block — a `table`, `diagram`, chart or
   `code` — beside it, never three screens away.
4. **A comparison matrix** when options are weighed: rows are problems or
   criteria, columns are options, cells from a closed vocabulary (yes / partly
   / no, with a short note), plus a legend. Read-across must be honest — a
   "partly" with a condition beats a generous "yes".
5. **A recommended path**, ordered, with the trigger for each step ("when
   someone else needs access → …"), not just a ranked list.
6. **Decisions still open**, each with a suggested default and the reason, so
   the page moves the decision even where it can't make it.
7. **Sources last**: where each claim comes from, `file:line` pinned to a
   commit for code claims. The numbered-citation mechanics are in
   `kages-research-briefs`.

## Composition rules

- The whole page answers *one* question. A second question is a second Kage.
- Audience toggles (a `choice`/`tabs` bound to state) may re-emphasise sections
  — highlight, reorder, change the verdict text — but never silently hide the
  evidence for the unchosen audience.
- Computed figures over hand-typed ones — `$count`/`$sum`/`$add` over `data`
  — so a changed row cannot leave a stale sum. A numeric `delta` on `stat`
  renders as a percentage; pass a string ("-3") for an absolute change.
- At 390 px everything still reads: matrices scroll inside their block rather
  than forcing page scroll; diagrams follow `kages-diagram-authoring`.
- Revise panel by panel: a follow-up about one section patches that section's
  blocks, leaving the rest byte-identical for a clean version diff.

## Handing it off

The reply is two or three lines: the conclusion and the link. Run the gate
(validate, screenshot at 390/1200, dark) before sharing; mention checks only
when one failed or a warning stands. Note on the page what was abstracted away,
what is illustrative, and what evidence is missing — an answer page that hides
its gaps is wrong even when its verdict is right.
