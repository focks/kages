---
name: artifact-art-direction
description: "Designing expressive, interactive Kages: semantic palettes, responsive diagrams, purposeful controls, and rendered review. Read when changing authoring guidance or creating a visual starter."
---

# Artifact art direction

Before assembling blocks, choose the audience, the task, the visual hierarchy,
and the interaction that helps the reader complete the task. A colorful page
with inert controls is still unfinished.

Use `section` palette (`ocean`, `mint`, `violet`, `amber`, `rose`, or `inherit`)
by meaning. Carry the same role color from diagram to explanation. These
palettes provide contrast-checked light/dark tokens; do not hardcode raw colors
into document data. `scale:hero`, `level:1`, and `backdrop:wash` create a strong
opening. Keep ordinary chapters quieter. `inherit` preserves workspace branding.

Use `diagram` nodes `{id,label,group?,palette?}` and edges
`{from,to,label?,palette?}` for directed relationships. Auto layout layers DAGs
by edges and switches to vertical on narrow containers. Cycles use a grid;
complex graphs can scroll. Explicit x/y retains legacy geometry and does not
support the new palette/selection presentation. Avoid a giant architecture map
when several small diagrams would explain the relationships better.

Most diagrams should stay static with the takeaway in the caption; the
static → interactive → explore ladder is `graph-interaction-levels`, and lint
(`selection-unused`, `needless-explore`) holds the floor. When a graph does
earn interaction, set `interactive:true`, bind `selected` to state, and handle
`select` (`$event:id`) to update a detail panel. The entire node supports click,
Enter, and Space. Give controls a consequence, an alternate state, and reset.
Use the `reader-account-explorer` starter as the complete reference.

Validate and lint, then screenshot at 390 and 1200 pixels and in dark mode.
Inspect the images; test the primary interaction, changed result and reset in
a browser. State explicitly if a check could not run. Hidden responsive SVGs
must be excluded from text-size measurements.

A versioned component must render through the bundle's `implementation(ref)`
lookup: export-name derivation loses the version, and role resolution follows
the current system rather than a signed lockfile. Preserve old implementations
and use the legacy resolver only for older bundles without this accessor.

Authoring skills should stay short. Put catalogs and worked examples in linked
reference files and ship them together through plugins, installation, CLI pack
export, HTTP and MCP resources. Never leave a reference that only works in one
harness.
