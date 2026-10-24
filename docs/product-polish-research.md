# Kages product polish and capability proposal

Research date: 24 October 2026. Status: research and delivery proposal;
selected capabilities now exist in the implementation under review. The implementation
status below distinguishes those changes from shipped functionality.

Kages should make coherent interactive documents easy to produce: distinctive
enough for a publication or lesson, precise enough for an analytical tool, and
reliable enough to share. The first investment should be consistent presentation
and deeper behavior in existing blocks. Expanding the component count alone will
not solve the quality gap.

## Scope and evidence

This review combines the current repository, the Visual Atlas creation and review
from this session, and official product/documentation sources. It is not a fresh
hands-on benchmark of competitor generation quality or a user study. Proposed
features and priorities below are recommendations, not measured conversion gains.
Effort is relative scope, not a delivery-date commitment.

The latest source check revisited Gamma themes, Anthropic artifact sharing,
Vega-Lite parameter binding, Datawrapper color guidance, React Flow layout and
W3C complex-image guidance. The supplied ChatGPT field-guide URL could not be
retrieved in this check; no new claims about that page's implementation are made.

## Current implementation status

The working tree now contains native canvas personalities; stable categorical
chart colors and chart context; responsive Cartesian plots with selections,
legend toggles, range controls, annotations and supplied uncertainty bands;
graph search, fit, explicit zoom, neighbors and collapsible groups; histogram,
box plot, waterfall and small multiples; and a local CSV preview/import block.
These are implementation changes, not evidence of complete
competitor parity. Existing immutable component references remain available.

The follow-through now includes gutter-routed graph connections, a Library
original/proposed polish preview, existing workspace font/design controls,
explicit refresh outcomes and session-state disclosure, PDF printing,
exact-origin controlled embeds, public copying and allowlisted selection links.
Library tiles render their immutable revision as a thumbnail. Four complete
cloud experiences demonstrate analytics, data exploration, sourced editorial
reading and diagram-based teaching; Showcase styling was also rendered and
reviewed. See `polish-implementation.md` for deployment, test evidence and links.
Host-backed personal/shared persistence still requires a configured host; the
public viewer states that limitation rather than implying saved progress.

## Product decisions I would make

1. **Make the reader's task the starting point.** Offer “Explain a topic”,
   “Compare options”, “Explore data”, “Teach a process” and “Present work”.
   Select structure and behavior from that task before selecting appearance.
2. **Give every Kage a compact design brief.** Audience, primary question,
   personality, density, data-color identities, primary interaction and evidence
   expectations should travel together through generation and revision.
3. **Use coherent defaults with deliberate variation.** A document can have a
   dramatic opening and quiet evidence sections without every block inventing
   another palette, border, heading size or interaction convention.
4. **Make polish a reviewable operation.** Propose changes, show before/after,
   preserve facts and interactions, and save the result as a reversible version.
   Treat this as a workflow feature, not a promise that a prompt improves design.
5. **Require complete demonstrations.** A scenario control must change results,
   a graph node must reveal useful detail, and filters must have visible state
   and reset. A catalog of disconnected widgets does not establish quality.

I would defer a freeform page builder, arbitrary artifact JavaScript, decorative
animation packs, 3D scenes and a large chart-library replacement until the core
reading and exploration journeys are reliably excellent. These add substantial
surface area without directly addressing the reported inconsistency.

## Benchmark before claiming parity

Use four identical briefs across Kages and the comparison products: an analytical
report, a sourced research guide, a scenario simulator and a process lesson.
Keep the data and requested interactions identical; record the model, prompt and
revision count. Score the outputs with reviewers who do not know their origin.

| Dimension | Observable evidence |
| --- | --- |
| Visual coherence | Consistent category identity, typography, spacing and emphasis |
| Comprehension | Reader can answer the brief's main question and find supporting evidence |
| Interaction | Primary task, changed state and reset work with pointer and keyboard |
| Mobile | Useful composition at 390px; readable labels and intentional bounded overflow |
| Accessibility | Contrast, visible focus, meaningful labels and equivalent chart data |
| Reliability | Empty/error/large-value cases, normal wheel scrolling and anonymous viewing |
| Authoring cost | Revisions and time needed to reach a usable result |
| Delivery | Load cost, shareability and reproducibility of the published version |

Set numerical targets after collecting a baseline. A passing validator or a
larger block catalog does not answer whether readers prefer or understand the
result better.

The code review covered designs, presentation palettes, chart rendering,
diagram layout, authoring starters, host capabilities, sharing and screenshot
checks. It did not exhaustively test every existing integration or admin screen.

## What already exists

Preserve these foundations rather than presenting them as new work:

- Three design systems and workspace designs with light/dark colors, font
  choices, corner radii and per-version snapshots (`src/engine/design.ts`).
- Named region palettes, hero sections, responsive layouts, chapter guides,
  rich disclosures, research content, reusable compositions and examples.
- Sixteen visual types demonstrated in the Atlas, safe computation, reactive
  controls, selection in several visual blocks and accessible chart data tables.
- Directed diagram layout, keyboard node selection and mobile vertical layout.
- Versioned documents, validation, linting, screenshots, comments, public links,
  project sharing and a `clone_kage` operation.
- Host-mediated storage, fetching and agent capabilities. These primitives do
  not by themselves establish that every published surface has a complete,
  configured live-data or persistence experience.

## Confirmed weaknesses

| Finding | Evidence | Consequence |
| --- | --- | --- |
| Chart colors use position | `rich.js` defines `SERIES` using accent, wire, success, danger and ink-muted; `charts.js` calls `seriesPaint(index)` | Reordering/filtering can change category identity; ordinary categories reuse status colors |
| Treemap sorts before coloring | `CoreTreemap` sorts descending and then colors by resulting index | A category can change color when its value changes |
| Region styling recolors charts | `presentation.ts` resets all color roles for each palette | Changing a section's appearance changes data colors inside it |
| Design settings have a narrow vocabulary | `DesignDef` offers colors, fonts and radius | Density, type scale, chart style and motion character lack one shared design definition |
| Basic line/scatter presentation is sparse | `expressive.js:plot` uses fixed geometry, minimal extrema labels and one accent; x/y labels appear in its table | Limited axis control and contextual explanation; no standard point-selection or range-selection contract |
| Mobile chart strategy favors local horizontal scrolling | Wide SVG figures receive a minimum width | Text survives, but a phone reader must often pan a chart instead of receiving a mobile composition |
| Diagram layout is bounded and basic | `diagrams.js` layers DAGs; cycles fall back to a grid | Larger relationship maps need better routing and navigation |
| Quality checks emphasize validity and rendering | Validator, lint and screenshot metrics catch structural/rendering faults | A technically valid artifact can still have weak hierarchy or inconsistent meaning |

The Atlas palette revision fixes the visible example. It does not fix the
underlying category-color model, and matching colors by ordering arrays is not
a durable product solution.

## Lessons from other products

| Reference | Documented capability or principle | Recommendation for Kages |
| --- | --- | --- |
| [Gamma themes](https://help.gamma.app/en/articles/11029150-how-do-i-customize-themes-colors-and-fonts-in-gamma) | File themes and reusable workspace presets; theme and layout template are distinct | Keep per-version design snapshots; separate visual personality from content structure |
| [Claude custom artifacts](https://academy.claude.com/tutorials/build-custom-artifacts-with-claude) | Task-specific tools, conversational iteration, shared inputs and connected tools | Make complete experiences and editability the unit of quality |
| [Claude sharing](https://support.anthropic.com/en/articles/9547008-discovering-publishing-customizing-and-sharing-artifacts) | Shared artifacts, customization and domain-controlled embedding | Build on existing public links and cloning with clearer remix/embed journeys |
| [Vega-Lite scales](https://vega.github.io/vega-lite/docs/scale.html) | Explicit domains mapped to visual ranges | Declare stable data-color mappings independent of rendering order |
| [Vega-Lite selections](https://vega.github.io/vega-lite/docs/selection.html) | Point and interval selection parameters | Standardize selection and linked filtering across visual blocks |
| [Observable Plot interactions](https://observablehq.github.io/plot/features/interactions) | Nearest-point tips and crosshairs; direct selection and zoom have documented limitations | Add useful detail on demand; do not assume adopting a library provides every interaction |
| [React Flow layouts](https://reactflow.dev/learn/layouting/layouting) and [viewport](https://reactflow.dev/learn/concepts/the-viewport) | Layout-engine tradeoffs and explicit pan/zoom behaviors | Treat graph geometry and graph navigation as separate concerns |
| [Datawrapper color guidance](https://www.datawrapper.de/academy/what-to-consider-when-choosing-colors-for-data-visualization) | Stable variable colors, explicit meaning, appropriate categorical/sequential/diverging schemes | Establish chart color semantics, not a collection of unrelated palettes |
| [W3C complex images](https://www.w3.org/WAI/tutorials/images/complex/) | Short identification plus fuller descriptions of meaningful visual information | Pair charts with takeaway text and accessible data; labels alone are insufficient |
| [Framer reduced motion](https://www.framer.com/help/articles/troubleshooting-animation-issues/) | Motion responds to reader preferences | Extend Kages' existing reduced-motion support when adding transitions |

OpenAI documents an [HTML/React prototyping workflow](https://openai.com/business/learn/prototyping-with-canvas-in-chatgpt/),
but product names and availability have changed in its
[release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes).
This review does not claim current ChatGPT Pages feature parity from older Canvas
documentation. The user's earlier field-guide reference is a design target,
not evidence of a universal Pages capability contract.

Claude's newer Academy material describes saved inputs and connected tools while
older help material lists narrower limitations. Treat those capabilities as
surface/plan-dependent; do not build a competitor checklist from old limits.

## 1. One presentation system with distinct personalities

Extend workspace designs with a bounded presentation profile: type scale,
density, content width, surface treatment, chart palette and motion policy.
Keep the values validated and versioned. Continue to separate application chrome
from the artifact's own design.

Offer five carefully designed presets:

| Personality | Characteristics | Best use |
| --- | --- | --- |
| Editorial | Expressive display type, generous reading rhythm, figures and marginal notes | Research, field guides, essays |
| Analytical | Compact spacing, tabular numerals, restrained chrome, precise axes | Dashboards and comparisons |
| Exploratory | Split views, linked selections, clear reset and undo | Simulators and decision tools |
| Teaching | Progressive reveals, worked examples, feedback and progress | Lessons and onboarding |
| Showcase | Strong image hierarchy, spacious sections, restrained transitions | Portfolios and product stories |

These should be presets over shared primitives, not five separate renderers.
Allow bounded local emphasis while inheriting document defaults. A style switch
should preserve content, calculations, selected state and category identity.
Show a preview before applying it as a new version.

## 2. A chart grammar shared by all charts

Introduce named categorical, sequential and diverging scales. A category maps
by stable ID to a color; order only affects layout. Separate chart-series tokens
from success/danger and from decorative section accents. Unknown categories need
a deterministic fallback and a visible legend; crowded palettes need labels or
patterns, not endless reuse of similar colors.

Add a common chart frame with a title, takeaway, units, source, date/freshness,
legend, loading/error/empty states and data-table access. Support explicit axis
domains and ticks, sensible number/date formatting, reference lines and
annotations. Do not generate unsupported causal conclusions or silently change
axis ranges in a way that exaggerates a comparison.

Standardize focus/hover details, point selection, legend toggles and shared
filter state. Add interval selection and reset after that foundation. A click
on a category should update the related table and explanation consistently.
Provide touch and keyboard paths rather than hover-only information.

Only then add missing high-value types: histogram, box plot, waterfall, small
multiples and uncertainty bands. Each needs a real use case and a readable mobile
form. Do not import arbitrary Vega specifications or executable callbacks into
untrusted documents; a renderer library can sit behind Kages' own contracts.

## 3. Diagrams people can explore

Prioritize fit-to-view, explicit zoom buttons, node search, connected-neighbor
highlighting, expandable groups and a linked details panel. Add layout choices
for trees, swimlanes, sequences and dependency graphs, with better routing and
label collision handling. Evaluate ELK/Dagre-style layout behind a bounded
trusted implementation before choosing a dependency.

Normal wheel movement must continue scrolling the page. Use an explicit
interaction mode or modifier for zoom; expose keyboard and touch alternatives.
Drag editing is a later authoring capability, not a prerequisite for a useful
reader. A Mermaid importer could compile a supported subset into validated
blocks and clearly reject unsupported syntax.

## 4. Reusable experiences rather than isolated widgets

Build polished compositions for scenario comparison, parameter sweeps,
before/after inspection, step-by-step explanations, evidence browsing and
recommendations with editable assumptions. Reuse current state, expressions,
guides and compositions instead of inventing a parallel app model.

Add a small motion vocabulary: state transitions, staged explanation and
highlighting a changed result. Motion must convey a change, respect reduced
motion, stay interruptible and never hijack page scrolling. Avoid decorative
autoplay as the default.

## 5. A visible quality loop for authoring

Generation should produce an explicit audience, task, structure, personality,
data-color mapping and interaction plan before filling blocks. Use existing
briefs and starters as the base; add only missing structured fields.

Make the normal workflow: compose → validate → exercise controls → render
desktop/mobile/light/dark → critique → revise. An optional polish action should
show a proposed patch and visual comparison, with undo through version history.
It should preserve facts and behavior while changing presentation.

Add advisory checks for palette drift, category identity, unreadable or missing
units, unused interactions and overly dense mobile layouts. Keep subjective
style advice separate from correctness failures. Screenshot diagnostics should
not be described as proof of good design.

Skills need concise decision rules and curated examples with variation. They
must say when to use a component, how colors carry meaning, what happens after
a click, and how to verify it. They cannot repair missing renderer capabilities.
Avoid making one oversized skill the dependency for every task.

## 6. Data, sharing and product finish

Build a coherent data experience over the host bridge: CSV import with type
preview, source/units metadata, explicit refresh, last-successful-update time,
stale/error states, and documented personal versus shared persistence. Preserve
the data snapshot used by a published revision when reproducibility is promised.
An immutable document does not make mutable external data reproducible.

Improve the published experience with reliable thumbnails, a clear preview of
what visitors see, a discoverable make-a-copy flow, chapter/selection links,
print/PDF layouts and domain-controlled embeds. Existing links, clone operations
and comments are the foundation. Serialization of reader state must use an
allowlist and exclude private inputs. Core content should remain useful without
sign-in; identity-dependent writes need their own flow.

For the Library, prioritize meaningful previews, easy recovery of recent work,
clear draft/published status, a visible design choice, and a compact publish
review. Audit actual tasks before reorganizing navigation. Feature discovery
should come from strong examples of finished work, not a long list of block names.

## Delivery order and acceptance

| Stage | Work | Relative scope | Acceptance |
| --- | --- | --- | --- |
| 1: Coherence | Stable category colors; separate surface/data tokens; shared chart frame; authoring rules | Medium | Filter/sort/update values without recoloring a category; section styling leaves chart meaning intact; old pinned versions unchanged |
| 2: Personality | Five presets; type/density controls; curated compositions; mobile adaptations | Medium–large | Same content in editorial and analytical styles looks intentionally different and retains behavior at 390px and desktop |
| 3: Exploration | Chart selections and tips; linked filters; graph navigation and grouping | Large | A reader completes comparison/inspection tasks by mouse, touch and keyboard; wheel scrolling never becomes trapped |
| 4: Production experience | Data freshness/persistence UX; exports/embeds/remix; polish preview | Large, split into releases | Shared links work anonymously; exports preserve meaning; refresh failures and persistence scope are visible |

Start by turning the Visual Atlas into a permanent regression fixture. Include
reordered categories, changed rankings, zero/missing/negative values, long labels,
empty results, linked selections, dark mode and narrow containers. Add a research
guide, simulator and dashboard as additional benchmark tasks.

For each release record task completion, interaction failures, visual defects,
generation retries, payload/load cost and accessible navigation. Establish a
baseline before setting numerical performance targets. Compare designs with
blind reviewer preferences on the same content, and record model/version/prompt
when evaluating agent output. A passing test suite is necessary but does not
establish parity with Claude or ChatGPT.

## Implementation boundaries

Changes belong in shared engine/contracts, design-system source, compositions,
host/runtime and authoring packs according to the existing architecture. Extend
the oracle additively, add goldens before engine behavior, regenerate through
`build:ds`, and keep original acceptance fixtures. New behavior receives new
contract/runtime pins; upgrade existing artifacts through new revisions.

Avoid a rewrite, arbitrary artifact HTML/JavaScript, a mandatory heavyweight
chart/graph bundle on every page, or silent restyling of published versions.
Prototype any renderer dependency against bundle size, accessibility, deterministic
output, licensing and sandbox compatibility before adopting it.

The recommended first release is coherence: stable color meaning, a shared chart
frame and reliable mobile reading. It directly addresses the problems observed
in the Atlas and gives every later personality and feature a stronger base.
