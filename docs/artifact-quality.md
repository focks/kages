# Expressive artifacts

The quality gap had several causes: oversized authoring skills buried the design
workflow, section contracts offered little visual hierarchy, diagrams used a
flat grid with truncated labels, and the runtime selected implementations by
export name rather than exact contract version. Changing prompts alone would
not fix all four.

## Available now

- Section palettes: ocean, mint, violet, amber, rose, or inherit. Each supplies
  contrast-checked colors for both themes, including controls, links and focus.
- Hero typography, heading levels and optional gradient washes.
- Directed diagrams with curved arrowed connections, category colors, wrapped
  labels, edge captions and automatic vertical layout on narrow containers.
- Whole-node mouse/keyboard selection with a public selected output, suitable
  for connected explanations. Existing state, expressions and actions power
  calculators, filters, conditional recommendations and resets.
- Short authoring skills with linked catalogs and individual examples, shipped
  through all pack/install/plugin/resource paths. The workflow now requires
  design intent, useful interactions, screenshot inspection and revision.
- Exact implementation lookup preserves component versions when newer section
  and diagram implementations coexist with older contracts.

Try `public/ds/reader-account-explorer.kage.json`, also available in the starter
catalog. It combines a color-coded ownership diagram, linked explanation,
account recommendation and warehouse-usage calculator. The numeric inputs are
illustrative, not a price quote. The original Snowflake document is unchanged.

```sh
node bin/kages.mjs validate public/ds/reader-account-explorer.kage.json
node bin/kages.mjs lint public/ds/reader-account-explorer.kage.json
node bin/kages.mjs screenshot public/ds/reader-account-explorer.kage.json --width 390,1200 --out /tmp/kages-review --url http://localhost:3100
node bin/kages.mjs screenshot public/ds/reader-account-explorer.kage.json --width 390,1200 --dark --out /tmp/kages-review-dark --url http://localhost:3100
```

## Boundaries

Artifacts remain validated data, with no arbitrary HTML or executable code.
Diagram layout is deliberately bounded (200 nodes / 400 edges); cycles use a
grid, and large branched graphs may scroll. This is not a graph editor: dragging,
pan/zoom, Mermaid syntax and automatic edge-crossing minimization are not added.
Explicit coordinate diagrams keep the legacy renderer. Existing signed artifacts
retain their pinned assets; they need a new revision to adopt new presentation.

Better defaults and examples raise the baseline; they do not establish parity
with every Claude or ChatGPT artifact. Evaluate future authoring changes on the
same prompts, inspect rendered outputs, and check task completion as well as
appearance. Installed plugin caches must be refreshed from the rebuilt package
to receive the updated skills.

## Validation of this change

- Full suite: 799 tests, 784 passed, 15 skipped, no failures.
- Production build and TypeScript check passed. The final pack/export adapter
  checks also passed after normalizing generated skill whitespace.
- Eight screenshots passed layout diagnostics: Core light/dark, Ledger and
  Atelier, each at 390 and 1200 pixels. Core mobile and dark desktop were
  visually inspected for hierarchy, diagram labels and contrast.
- Browser interaction review exercised diagram mouse selection, Enter selection
  with `aria-pressed`, an existing-account recommendation, calculator changes
  from 44 to 176 credits, and reset to 44.
- Contrast checks cover the five palettes in both themes. Golden fixtures retain
  the original engine acceptance behavior and add the new example in all systems.
