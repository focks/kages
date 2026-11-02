# Authored system boundaries

Use `boundary-diagram` when spatial placement explains an architecture:
asymmetric zones, different card sizes, mixed prose and code, and arrows to
specific rows or cells. Use `diagram` for automatically placed graph nodes;
use `scene` for geometric subjects such as annotated floor plans.

The [complete neutral example](examples/boundary-diagram.kage.json) has three
zones, stacked source rows, a database cell grid, a planned connector, and
solid/dotted/dashed/two-way routes. All names and quantities are illustrative.
It ships in the full installed library as
`reference/examples/system-boundary-example.kage.json`. It validates offline with `kages validate docs/examples/boundary-diagram.kage.json`.

The installed contract is `core/boundary-diagram@1.0.0`, inherited by Ledger
and Atelier. `kages catalog` and `get_contract` expose its full vocabulary.
A drawing requires at least one zone or card, and supports up to 2000 rectangles
in total. Sibling and non-nested cards/cells may not overlap; enclosing zones
are exempt. Each rectangle has an ID and finite `x`, `y`, `width`, `height`; children use
coordinates relative to their parent. `title` and `subtitle` have fixed
baselines 33 and 59; `lines` carry `{text,y,x?,font?:"mono"|"sans"}` and
`rules` carry y coordinates. A line may set `emphasis:"accent"`; ordinary lines
remain ordinary regardless of their position. Keep every baseline and line inside its card.
The optional `outline:"muted"|"strong"` chooses a semantic border token.
Nested cells can span columns by choosing a larger width.

An edge names `from`/`to` card or child IDs and `fromSide`/`toSide`. Optional
`fromPort`/`toPort` choose a fraction along that side. `via` supplies canvas
waypoints; author orthogonal routes through gutters. Edge labels have explicit
`labelX`/`labelY` baselines. Use `arrows:"none"` for future dependencies,
`"end"` for one-way flow, or `"both"` for request/response. `style` is `solid`,
`dashed` or `dotted`. `palette:"ocean"` identifies requests and `"amber"`
identifies writes; both channels have contrast-checked technical theme tokens
when no workspace design is active. A pinned workspace design takes precedence
over the technical palette. Zone `style` overrides its default dashed outline; explicitly choosing dashed
keeps the same 8/7 pitch as the default. Under pinned designs, ocean request
labels use secondary text colour while strokes retain the wire colour.

This form is static. A focusable scroll region keeps the authored text at its
original size on narrow containers, preserving topology and preventing page
scroll. Readers can use a trackpad, touch or keyboard arrows. Render at 390px
and the authored width, in light and dark; inspect both ends of the drawing.
Unknown endpoints, duplicate IDs, out-of-parent rectangles and malformed
geometry, unknown nested keys and zero-length route segments fail validation
and render as an alert rather than dropping content. Label coordinates require
label text. `kages screenshot` reports real glyphs extending outside a card or
canvas and text hidden by a later opaque rectangle; it measures fonts after
loading, rather than guessing string widths. Invalid drawings also produce
screenshot findings. Put a child cell’s text inside its own `lines` to keep it
above its fill.
No HTML, SVG markup, inline CSS or image data is accepted as drawing instructions.
