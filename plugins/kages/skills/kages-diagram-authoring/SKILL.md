---
name: kages-diagram-authoring
description: Choosing and composing the right visual block for a subject — diagram, scene, chart, timeline, stepper — plus density and label rules, the steps-beside-the-picture pattern, the bounded render-and-repair gate, and honesty rules for diagrams of real systems. Read before putting a diagram, scene or flow illustration in any Kage. Palettes and interactivity live in artifact-art-direction.
---

# Diagram authoring

A diagram earns its place when the *shape* carries meaning a list cannot:
branches, boundaries, cycles, who-calls-whom. If the content is a plain
sequence or a ranking, use `list`, `stepper`, `timeline` or a chart instead.
(Discipline adapted from Archify — github.com/tt-a1i/archify — re-grounded in
Kages blocks; palette and interaction rules are in `kages-artifact-art-direction`.)

## Pick the block from the subject

| Subject | Block |
| --- | --- |
| Components, services, layers, boundaries | `diagram`; `group` per layer/boundary |
| A process with gates and branches | `diagram`; the happy path is the longest chain, branches hang off it |
| States and transitions, retries, terminal states | `diagram`; terminal nodes get their own palette |
| Call order between parties | `stepper` beside a `diagram` (pattern below) |
| Where data or money moves | `diagram` with edge labels naming the payload |
| Timestamped events | `timeline` |
| Quantities, durations, comparisons | a chart block — never rectangles in a `scene` |
| Custom geometry (floor plan, annotated figure) | `scene`, token colors only |

Never draw a table of fields as a diagram (`table` does it better), and never
fake a chart with shapes: chart blocks carry the accessible data table for free.

## Importing Mermaid

Do not hand-copy a fenced Mermaid flowchart: run `kages from-mermaid <file>`
(operation `mermaid_to_diagram`). It compiles `graph`/`flowchart TD|LR` —
labelled edges, chains, `&` fans, `subgraph` → `group` — into one **static**
`diagram` block, lists every drop as a note (shapes, styles, `click`), and
rejects whole anything it cannot preserve: other diagram kinds, unknown lines.
A rejection means keep the original as a `code` block and say why. After an
import, add palettes by role and a caption takeaway, and climb the
`kages-graph-interaction-levels` ladder only if the selection will drive something.

## Density and label rules for `diagram`

- **Let auto layout place nodes.** It layers DAGs by edges and goes vertical on
  narrow containers. Explicit `x`/`y` is legacy geometry — it loses the
  palette/selection presentation — so shape the picture through edge structure,
  `group` and the `layout` prop (`horizontal`, `vertical`, `tree`, `swimlane`,
  `sequence`), not coordinates.
- **Color by role, not decoration.** Give nodes and edges a `palette`
  (`ocean`/`mint`/`violet`/`amber`/`rose`) per *role*, reuse the same palette in
  the section that discusses that role, and name each `group` — grouped,
  palette-coded nodes are most of what makes a diagram read at a glance.
- **Static is the default.** Most diagrams are read, not operated: put the
  takeaway in the `caption` and stop. Add `interactive:true` only when the
  selection drives another block, and `explore:true` only for big or grouped
  graphs — the ladder, and the lint rules that enforce it, live in
  `kages-graph-interaction-levels`.
- **One dominant direction.** The main journey is one chain of edges; side
  concerns branch off rather than weaving through it.
- **Edge labels name the action or payload** ("signs", "snapshot JSON"), three
  words or fewer. A label that repeats both node names says nothing; minor
  edges go unlabelled.
- **6–12 nodes per diagram.** Over that, split: one overview plus per-area
  diagrams in `tabs` or an `accordion`. Several small diagrams beat a giant map.
- **A legend when palettes mean something**: a short `badge` row above the
  diagram, same wording as the prose.

## Rules for `scene`

- Token colors only — that is what survives dark mode and workspace designs.
- Every meaningful shape gets a `label`; decorative ones don't.
- Text must still read at 390 px width; if it only reads at 1200 px it fails
  on a phone.
- Reach for `scene` only when the content is genuinely geometric; if it is
  nodes and edges, `diagram` is the block.

## Steps beside the picture

When a page *walks through* a flow (not for every diagram), pair an
interactive `stepper` with the diagram it describes — and wire it *both ways
through one state key*: the stepper's
`value` and the diagram's `selected` both bind to the same state, and each
one's event sets it. Walking the steps highlights the node; clicking a node
moves the steps. Drive a per-step detail block from the same key (`visible` on
`$eq`). A stepper that only changes text while the picture sits still is the
single most common way this pattern goes flat.

Give every chart near a diagram its context props too: `takeaway` (the
sentence the reader should leave with), `source`, `updatedAt`, and a
`colorDomain` listing category labels in one fixed order so colors stay stable
across every chart on the page.

## The gate: render before you hand off

1. Validate/lint to zero errors (`kages validate`, or the findings on save).
2. `kages screenshot <file> --width 390,1200 --dark -o shots/` — read the
   findings **and look at the images**: overlapping labels, clipped nodes, a
   diagram forcing sideways scroll at 390 px.
3. Repair and re-render, **at most two rounds**. If round two still fails,
   simplify — fewer nodes, shorter labels, a split — rather than nudging a
   third time.

Never claim visual quality you did not render. "Findings-clean" means the
checks passed; "looks right" requires having looked.

## Diagrams of real systems stay honest

- Trace the code first. Every node and edge corresponds to something you can
  point at — cite `file:line` in the prose or a `code` block beside the figure.
- Do not invent topology to balance a picture. State omissions in the caption.
- Illustrative numbers are labelled illustrative on the page; missing personal
  facts are asked for, not made up.
