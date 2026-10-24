---
name: coherent-presentation
description: Native canvas personalities, consistent data colors and analytical charts. Use when authoring polished reports or extending chart presentation.
---

# Coherent presentation

Use `canvas` for a designed report or tool. Choose one personality: analytical,
editorial, exploratory, teaching or showcase. `appearance: inherit` follows the
reader; light/dark is an intentional artifact choice. Put metric grids and
chart blocks directly in its children. The `allocation-lab` starter demonstrates
a dark analytical report with synthetic figures, native responsive bars and
linked selection. It is not a factual source for financial or market claims.

Data colors and decorative colors have separate meanings. Declare the same
`colorDomain` on related charts. Donut/treemap use item labels, multi-series
charts use series names, Sankey uses node IDs. Bar charts default to uniform
paint; `colorBy: category` uses item `category` or its label. A declared domain
avoids fallback hash collisions; do not make array order stand in for identity.
Section palettes must never overwrite `--kg-data-*` tokens.

Each chart supports `takeaway`, `unit`, `source`, `updatedAt`, and
`status: ready|loading|error|stale` with optional `statusMessage`. Bind these to
actual loading outcomes; a timestamp typed into a document is not automatic
freshness detection. Never imply a source was refreshed if it was not.
Keep exact values available in the data table. Compact bar labels are optional
(`compactValues`); mobile labels move above bars instead of shrinking the plot.

Implementation lives in `polish.js/css`, compiled into the single oracle.
New chart contracts wrap existing geometry with a shared frame and inject a
trusted paint function. Untrusted document JSON cannot supply callbacks. Legacy
refs preserve positional paint. Add new behavior through new refs and regenerate
assets; never edit a pinned public bundle.

Verify changed rankings, filtered/reordered categories, dark/light presentation,
negative and extreme values, loading/error states, keyboard selection and mobile
rendering. A clean validator is not a substitute for looking at the result.

`polish_kage` proposes a reversible presentation patch and advisory checks for
chart context, inconsistent category domains, dense grids and isolated controls.
It never invents sources or units, rewrites facts or changes explicit component
references. Preview defaults to a read; pass `apply:true` and the preview's `from`
as `baseVersion` to save. The returned `undo` patch can be applied through
`patch_kage` against that new version. Both changes create versions. A stale
version must be re-reviewed rather than force-applied. The Library exposes the
same operation with original/proposed and phone-width previews.
