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

Use the complete examples as task recipes: `evidence-workbench` links a cohort
filter and scenario multiplier to plots, bars, a table and a histogram;
`signal-field-guide` combines chapters, sources, filtering and a review checklist;
`systems-classroom` connects graph selection to explanations and a quiz. Reset
must clear related ranges, hidden series and selections as well as filters.

`csv-import` previews typed columns before an explicit import event. Imported
rows belong to session state unless a configured host saves them. Change source
labels after import; do not keep describing reader data as the bundled sample.
For refresh, a fetch action's `statusInto` names an outcome object and
`pendingInto` names a loading flag. Bind `source-status` to those values.
Successful responses advance `updatedAt`; fallback mock data reports `sample`;
`retainOnError:true` preserves an existing snapshot and reports `stale` on failure.
Never label a failed refresh as current. The public viewer does not provide
personal/shared storage or unrestricted fetch; disclose the actual session scope.

Controlled embeds require `set_embed_policy` with exact allowed origins and the
current `baseVersion`, followed by publishing the resulting draft. The dedicated
`/embed/<uuid>` route checks published visibility and origin policy; it does not
enable host services. A copied artifact does not inherit that origin policy.

For shareable selections, declare `meta.shareState` as up to twelve existing
top-level scalar state keys, such as `scenario`, `category` or `selected`.
“Copy link to this view” records those controls and the current chapter in the
URL fragment; opening it restores a session view without changing the published
version. Never opt in sensitive inputs. Imported rows, object/array values and
keys declared in `persist` are excluded. Shareable strings are bounded to 120
characters, and the encoded selection is capped at 4,000 characters.
