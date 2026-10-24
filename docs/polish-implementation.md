# Product polish delivery tracker

Active objective: implement the research proposal and the supplied analytical
dashboard reference, verify, commit and push (which deploys), then create four
new cloud Kages demonstrating the improvements. This tracker preserves the full
scope across work sessions; unchecked items are not delivered.

- [x] Inspect reference image and current repository.
- [x] Shared chart color identities, separate from section/status colors.
- [x] Shared chart framing, units, source/freshness, loading/error/empty states.
- [x] Native analytical dashboard matching the reference's visual characteristics.
- [x] Five presentation personalities, density/type controls and mobile adaptation.
- [x] Chart axes/formatting, annotations, selections, linked filters and resets.
- [x] Histogram, box plot, waterfall, small multiples and uncertainty support.
- [x] Diagram fit/zoom/search/neighbors/groups, layout and routing improvements.
- [x] Reusable scenario/teaching/evidence experiences and purposeful motion.
- [x] Authoring skills, advisory quality checks, polish preview and version-based undo.
- [x] Data import/types, source/freshness/refresh/error and persistence UX.
- [x] Library/publishing polish, copy/remix, export/print, controlled embeds and links.
- [x] Automated tests, browser interactions and rendered review across themes/sizes.
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


Release checkpoint: commit `3c2248b` pushed to main. Vercel deployment
`G9gVHnF6YDfXkBsk9vnn8EGZz1Cs` reports success. Authenticated cloud list_systems
returns core 1.16.0, ledger 2.13.0 and atelier 1.12.0; get_contract returns
core/canvas@1.0.0. The public app.getkages.com pinned bundle.js, bundle.css and
tokens.css all match the committed manifest's SHA-384 integrity values. The
manifest JSON itself requires authentication, so it was not used as public proof.
The full objective remains open: remaining checklist items and four final cloud
demonstrations have not been claimed as complete.

Second release verification: all 839 tests completed (816 passed, 23 opt-in
skips, zero failures); TypeScript and the production build passed. Six opt-in
browser checks passed for analytical scrolling/selection, plot and graph
controls, Library preview/apply/undo, copying, multi-page PDF and exact-origin
embedding. After the mobile diagram refinement, the three affected browser
checks and 19 focused tests passed again. Normal-scale routed diagrams now
expand with the page; only deliberate zoom uses a bounded scroll viewport.

Four complete starter documents validate and remain lint-clean/portable in all
three systems. Phone/desktop screenshots of all four have no diagnostics; the
workbench, lesson and guide overview/evidence chapter have been visually
reviewed. Their state tests cover linked scenario values, CSV import provenance,
reset, evidence filters, checklist state, node explanations and quiz feedback.
The classifier test follows the existing explicit-mode convention for these
reading/teaching experiences: input counts cannot infer their purpose.

Controlled embedding requires an exact-origin policy saved as a new draft and
then published. Real browser tests prove allowed/denied parents, policy
revocation, rendering in the opaque frame and denial of host services. Refresh
outcomes distinguish actual success, sample fallback, retained stale data and
errors; only success advances the timestamp. The public viewer explains its
session-only state. No configured persistent host service is claimed.

Still outstanding before completing the objective: richer selection links and
the final publishing/design-experience audit, deployment verification of this
batch, and creation/publication/review of four new cloud demonstrations. The
local demo documents are not evidence that cloud publication has occurred.

Second release deployed: `4295fa3` is on origin/main and Vercel deployment
`3sPmmidJSEYDhnqXJgp2gpnb8jZ4` reports success. Cloud list_systems returns
core 1.17.0, ledger 2.14.0 and atelier 1.13.0. Public bundle.js, bundle.css and
tokens.css at the committed content-addressed base match their SHA-384 hashes.


Final presentation/sharing checkpoint: scalar selection links now round-trip
through a URL fragment, preserving chapter navigation. Authors explicitly list
shareable controls in meta.shareState; imported/object data and persisted keys
are excluded. Unit tests cover malformed/oversized/prototype input and type
checks. A real browser copies a scenario/selected-bar link and restores both in
a fresh page, then resets and scrolls by mouse. Initial and asynchronous state
updates now reach the host callback as well as dispatched controls.

Library grid thumbnails render the listed immutable version through get_kage
in inert, opaque frames. Intersection observation releases offscreen renderers;
the browser check verifies the pinned read, actual chart rendering and unchanged
polish/apply/undo flow. The Library screenshot was visually reviewed. Workspace
font controls and preview remain available in the Designs editor; the Polish
panel supplies five personalities, two densities, appearance and before/after
phone previews. Showcase was reviewed at 390/1200 and the full dark workbench at
390, with no overflow or console diagnostics.

Validation: 842 tests, 819 passed, 23 opt-in skips, zero failures. Seven opt-in
browser checks passed separately (including chapter history, copy, print,
embeds, selection links and Library). The latest production build passed;
authoring-pack regeneration and its 11 focused tests passed. Cloud creation
and final live verification remain outstanding until the final code deploys.
