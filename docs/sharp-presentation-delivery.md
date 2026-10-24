# Sharper artifact presentation

The visual audit found repeated chart borders and instructions, mobile pages
opening with controls, tall empty areas beside metrics, oversized diagram nodes,
and competing floating viewer utilities. This iteration addresses those findings
through new contracts, improved starters and authoring guidance.

- Canvas 1.1 has primary `lead` and secondary `support` slots, with mobile controls
  disclosed on demand. Typography uses workspace fonts; density coordinates
  spacing, body size and control height.
- New chart contracts offer plain, inset and bordered treatments. Cartesian
  plots support integer period ticks, adjustable height and larger invisible
  point targets. Range controls use a disclosure.
- Diagram 1.5 uses compact neutral nodes, category accents, distinct ports and
  exterior feedback routes. Relationship tables preserve full labels. Explicit
  coordinates retain their existing geometry.
- Workbench opens with data and separates Compare, Statistics, and Data & import.
  Allocation stacks its two charts beside the metrics. Classroom leads with its
  graph. Field Guide has a shorter mobile masthead.
- Published viewing groups utilities in “Use this Kage”. Presentation mode keeps
  the running artifact mounted, retaining filters, selection and imported rows.
- Structural polish moves whole block references conservatively, preserving
  data, bindings and events, with an exact inverse patch. Explicit refs stay put.

Existing pinned bundles remain immutable. New versions resolve core 1.18.0,
ledger 2.15.0 or atelier 1.14.0; updating a starter does not rewrite old artifacts.
Dense diagrams may still require zoom and their full connection table.

## Validation

- Full suite: 845 tests, 821 passed, 24 environment-dependent skips, zero failures.
- Eight enabled browser tests passed: shared selections/reset, chart and graph
  keyboard controls, mobile support pane and import, presentation state retention,
  Library polish/apply/undo, anonymous copy flow, guide navigation/history,
  multipage print and mouse-wheel scrolling in preview/public/comment modes.
- Latest chart availability states (loading/error/stale/empty) and legacy refs
  verified in the focused renderer suite.
- Typecheck, production build, design-system compilation, contrast checks and
  generated integrity checks passed.
- Desktop and phone screenshots reviewed for all four starters and the actual
  published viewer shell. Local evidence: `/tmp/kages-refined/`.

Deployment and refreshed public demo versions are verified after release.
