---
name: free-flow-composition
description: "Extend Kages artifact layouts and content blocks without imposing a console shape. Covers additive oracle compilation, container-responsive composition, catalog guidance, examples and asset regeneration. Read when changing artifact design-system components or authoring guidance."
---

# Free-flow composition

Any catalog block can be the root. Choose a shape from the artifact's content:
`page` offers reading/wide/full canvases, `section` supports editorial regions,
`grid` fits collections to available width, `split` supports two panes, and
`stack` handles local rows/columns. A `shell` is an optional workspace layout.
Tabs may be primary navigation. Neither a sidebar nor a card around every
region is required. Product chrome and artifact layout are separate concerns.

## Extend the reference once

`originals/` remains the authority for existing behavior. Additive component
source lives in `src/design-system/free-flow.js` and `.css` because originals
is untracked. `scripts/ds-source.mjs` compiles additions inside the oracle's
closure before Core's roles are inherited. The same compiled oracle drives
extraction, golden capture and the served bundle. Do not create an independent
runtime registry or hand-edit `public/ds/bundle.*` or generated engine data.

Add each portable role's interface, implementation, contract, export and agent
guidance together. Preserve existing contract refs and metadata. Increment the
system's minor version for new capabilities. `authoring.guidance` updates the
catalog's advice without rewriting published contracts; the pure engine's
catalog must match the oracle's captured output.

Run `npm run build:ds`; it reads `originals/` when present, else the tracked `reference/` snapshot (byte-identical to the pristine oracle, so a rebuild must leave `git status` clean). It publishes the
extended bundle, extracts registries, captures goldens and examples, compiles
tokens, updates SRI and regenerates plugin skills. Tests use the committed
served assets and do not require originals. Add new goldens before adding
engine behavior. Keep the original acceptance counts unchanged.

## Prove the artifact shape

Add complete documents to `src/packs/examples.ts`, used by packs, starter
seeding and golden capture. Exercise the new contract through generation and
the operation table, rather than documenting an uninstalled escape hatch.

Responsive geometry follows the artifact container, not just the viewport:
Studio may have a narrow canvas inside a wide browser. Test mobile widths and
a narrow canvas in a desktop viewport. Splits collapse in source order; grids
fit their content without horizontal overflow. Use bounded semantic props and
spacing tokens; literal code/prose stays text and media URLs remain passive.

For controls, verify native keyboard behavior, the event payload, unwired local
defaults, public outputs and explicit state bindings. For content, verify
hostile strings remain literal, each export renders, and asset hashes match.
Check the real `KageRenderer` in Studio as well as the oracle renderer, in all
three systems and both themes.

## Use-case examples

`src/packs/use-case-examples.ts` holds one complete document per everyday use case (quiz, flashcards, architecture
explainer, game, pricing proposal, trip plan, runbook, meeting notes, portfolio); `contentExamples()` returns them, so
packs, starters, templates and goldens pick them up with no further registration. Add a case by writing the document there,
giving it a mode in `USE_CASE_MODES`, a row in `docs/use-cases.md`, and a behaviour test in `src/packs/use-cases.test.ts`
that plays it (a score, a winner, a filter), because rendering alone does not show that its logic works. Rules that kept
these lint-clean: put figures in `data`/`state` and compute them (a typed-in `stat` value is flagged in operate mode), give
every button a handler, label made-up figures illustrative on the page, keep one level of containers, and let a
selection drive a view (`$filter` to one row, then a repeat) instead of reading a field out of an expression.
Mind contrast: a diagram node with `tone: accent` fills with the accent colour and its label becomes unreadable.
