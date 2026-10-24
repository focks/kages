# Product polish delivery tracker

Active objective: implement the research proposal and the supplied analytical
dashboard reference, verify, commit and push (which deploys), then create four
new cloud Kages demonstrating the improvements. This tracker preserves the full
scope across work sessions; unchecked items are not delivered.

- [x] Inspect reference image and current repository.
- [x] Shared chart color identities, separate from section/status colors.
- [x] Shared chart framing, units, source/freshness, loading/error/empty states.
- [x] Native analytical dashboard matching the reference's visual characteristics.
- [ ] Five presentation personalities, density/type controls and mobile adaptation.
- [ ] Chart axes/formatting, annotations, selections, linked filters and resets.
- [ ] Histogram, box plot, waterfall, small multiples and uncertainty support.
- [ ] Diagram fit/zoom/search/neighbors/groups, layout and routing improvements.
- [ ] Reusable scenario/teaching/evidence experiences and purposeful motion.
- [x] Authoring skills, advisory quality checks, polish preview and version-based undo.
- [ ] Data import/types, source/freshness/refresh/error and persistence UX.
- [ ] Library/publishing polish, copy/remix, export/print, controlled embeds and links.
- [ ] Automated tests, browser interactions and rendered review across themes/sizes.
- [ ] Commit and push implementation; confirm deployment serves new contracts.
- [ ] Create and review four new cloud demonstration Kages; deliver their links.

The image is a visual reference, not a verified source for the numerical claims
inside it. Demonstrations must label synthetic data or cite verified evidence.
Existing immutable versions and untracked user documents must be preserved.

Checkpoint evidence: `polish.test.ts` verifies reordered/reranked/filtered colors,
old refs, availability states, signed/extreme bars, canvas portability and XY
selection/ranges. `polish-browser.test.ts` passes against localhost:3100 for
native keyboard selection, scenario/reset, mobile and wheel scroll. Allocation
and XY screenshots at 390/1200 passed diagnostics and were visually inspected.
Full suite before XY additions: 815 tests, 798 passed, 17 skipped. Typecheck
passed at that checkpoint. Further additions require new verification.

Current work: line/area/scatter 1.2.0 have responsive axes, supplied uncertainty
bounds, reference annotations, point details/crosshair, range controls and legend
toggles. The dedicated real-browser checks passed for XY selection, range and
legend controls and graph zoom, search, collapse and fit. Statistical charts and
CSV import have unit coverage; their rendered review remains outstanding.

Latest verification (24 October): design-system rebuild passed; typecheck passed;
full suite reports 821 tests, 802 passed, 19 skipped, zero failures. Two older
tests were updated to recognize the new default diagram contract and Cartesian
renderer; their legacy-reference checks remain. CSV preview copy now distinguishes
local preview from configured import actions instead of implying that downstream
actions can never transfer data. These are local results, not deployment evidence.

The expanded research report records prioritized product decisions, explicit
remaining gaps and a four-brief comparison benchmark. The broad roadmap above
remains active and uncompleted; no release or new cloud demonstrations are
claimed by this checkpoint.


Second implementation checkpoint: the `polish_kage` operation and Library panel
now provide advisory findings, exact patch inspection, original/proposed and
phone-width previews, guarded Apply, and version-based Undo. Three planner and
operation tests pass; a real local browser creates, previews, applies and undoes
a disposable Kage across three revisions, then deletes only that test artifact.
Published pages now expose copy, JSON download, chapter-link copying and a print
view. A real Chromium PDF test exports 30 sections across five pages and checks
the final marker with pdftotext. Print views over the existing 12,000px frame
limit visibly refuse the print action instead of silently claiming a full export.
A dedicated local browser check confirms the anonymous sign-in prompt, then
creates an independent copy through the normal API and verifies preserved data
and blocks. Controlled embeds and richer state links remain outstanding.

Statistical charts and CSV import were rendered at 390/1200 with no diagnostics
and visually inspected. That review led to range labels in the histogram and an
expanded CSV row preview. Full suite before those two small renderer refinements:
826 tests, 805 passed, 21 skipped; all four opt-in browser checks passed separately.
Focused tests after the refinements: 16 passed. Production build and deployment
are separate gates; creating the four cloud demonstrations is still outstanding.

Production build passed. Statistical charts and the expanded CSV preview also
passed rendered review in explicit dark appearance at 390px.
