---
name: artifact-design
description: "Design a Kage the way a design lead at a small studio would design a Claude artifact: read the request, ground it in the subject, choose a treatment, keep both themes, make the page complete at rest and name it like a product. Read before creating any Kage, deck or tool page the user will keep or share."
---

# Artifact design

A Kage is the same kind of object as a Claude artifact: a page someone opens,
reads or operates, shares and comes back to. Agents never write HTML here, so
the craft moves from CSS into choices of blocks, props, design and copy. The
principles are the ones the Claude `artifact-design` skill applies; this is how
each one is done in Kages. The skill Claude itself provides is included in full, unchanged, in
`reference/claude-artifact-design.md`; the packed copies (plugin skills and
`get_authoring_guide`) append it as an Appendix.

## Read the request first

Decide the treatment before opening the catalog. A plan, memo or demo gets a
plain, polished page: real hierarchy, considered spacing, no flashy opening. A
landing page, a game, or an app the user will keep gets an editorial treatment
with one deliberate point of view. If unsure, a well-composed page is always
acceptable; an over-designed identity sometimes is not. Declare the reader's
task in `brief.mode` (read, operate, persuade, experience) so mode-gated lint
checks what you meant.

## Respect what already exists

Precedence is the user's own words, then the workspace, then your choices.
Call `get_brief` for voice, audience and what must not be invented, and
`list_designs` for a workspace design. Dress the page with `set_kage_design`
instead of inventing colours. Do not pass `palette` on a region to look
different from the workspace; use it when a colour family carries meaning.

## Ground it in the subject

Name one concrete subject, its audience and the page's single job. Include at
least one detail only this subject has: its real units, document conventions,
terms of art. Use real content; lorem ipsum, invented customers, figures and
quotes are never acceptable. A figure you cannot source is labelled as an
example or removed (see `unsourced-claim` in lint).

## Type, colour and themes come from the system

Typography and neutrals are part of the design system, so choose the system
(core, ledger, atelier) for the personality you want and pair it with a
workspace design for brand colour. Every system ships light and dark and the
viewer's theme decides; never describe a colour as a literal. A custom design must keep text on its surface at 4.5:1 and a control edge at
3:1 in both themes.

## Complete at rest

Everything meant to be read is visible on first render. No section waits for a
scroll or a click to exist, and a hero is sized to its content. A tool opens in
a realistic working state: sample rows or a loaded example, clearly marked as
examples, never an empty shell. Interaction must change something the reader
cares about; otherwise leave the block static (see `graph-interaction-levels`).

## Structure is information

Numbering, eyebrows, dividers and labels must encode something true. Number
steps only when order is the content. One bordered container is a decision; a
card around every block flattens the hierarchy. Repeated elements share edges,
baselines and padding; a table carries comparisons, prose carries claims.

## When the page is a UI

It is scanned and operated, so put the summary before the detail, encode state
in form (a badge, a severity tone) as well as in numbers, and keep semantic
colour (success, danger) separate from the accent. Charts follow
`coherent-presentation`: one scale, labels that name values the chart reaches,
and a takeaway beside each.

## Copy

Write from the reader's side of the screen and name things by what people
recognise. Active voice; a control says exactly what happens. Errors say what
went wrong and how to fix it. Prefer specific to clever. Avoid em-dash asides,
"not X but Y" framing, colon-then-reveal sentences and stock phrases.

## Name it like a product

A title is a short noun phrase of two to four words that identifies this page
among many, or the question it answers. Never a category label alone and never
a title with an explanation after a dash. The explanation belongs in the
description.

## Avoid the generated look

Warm cream with a serif and terracotta, near-black with one acid accent, a
purple-to-blue gradient hero, emoji as section markers, everything centred.
When the user names a direction, follow it exactly. When they do not, spend
your one aesthetic risk in one place and keep everything around it quiet.

## Process

1. `get_setup`, then `get_context` for the system, and `get_brief`.
2. Settle the plan in the document itself: the mode, the structure of
   sections, the one detail only this subject has.
3. Author with declared blocks only, then `validate_kage` and `lint_kage`.
4. Render once with `render_kage` (see `visual-review`) at phone and desktop
   widths and fix what it reports. One pass, not a loop.
5. Publish, and give the user the link and one plain sentence on the direction.

## Publishing as a Claude artifact

`export_kage` with `format:"artifact"` (CLI: `kages export <name> --format artifact -o page.html`) returns
one self-contained page for Claude's Artifact tool: a `<title>`, the design-system
bundle inlined, React from the cdnjs allowlist, both themes through the
viewer's setting, and the Kage as inert JSON. Publish the file as it is with the
Artifact tool and pass the Kage's title as the name. Know its limits before you
promise a result:

- The page renders in the viewer's locked-down frame, so `https:` images are
  blocked. Use `data:image/png;base64,…` pictures or leave images out; a blocked
  image otherwise shows as an empty box.
- No host capabilities exist there (`ask`, `agent`, `connector`, `fetch`), and
  `load` sources show their `mock` data. Build artifacts for reading and local
  interaction, not for live data.
- The export needs the design-system files, so it works from a Kages checkout or
  a deployment, not from the single-file CLI.
- It is a snapshot: later versions of the Kage do not update a published page.
  Re-export and republish to the same artifact URL.

The Kage stays the source of truth; the artifact is one way to show it.

For a presentation use `slide-decks`; for a sourced case `research-briefs`; for
a status page `report-kages`; for one question `answer-pages`.
