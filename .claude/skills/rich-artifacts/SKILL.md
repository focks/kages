---
name: rich-artifacts
description: "How to add a rich block (chart, disclosure, overlay, work-app, media) to the Kages design system: source file, safe SVG geometry rules, accessible data tables, state defaults and commands, examples, tests and the build:ds run. Read before adding or changing a block in src/design-system/rich*.js."
---

# Rich artifacts

Batch 1 lives in `src/design-system/rich.js` + `rich.css` (area, donut, gauge,
sparkline, heatmap, alert, accordion, stepper, timeline, modal). Batch 2 is
`apps.js` + `apps.css` (switch, combobox, tree, data-grid, kanban, calendar,
carousel, markdown, math); radio group already exists as `choice`. Later
batches follow the same file pattern. Read `free-flow-composition` and
`expressive-artifacts` first; this skill is the recipe for one more block.

## Recipe

1. **Implementation + contract in one file.** Write `CoreX(p)` using only the
   oracle closure helpers (`h`, `S`, `choice`, `fire`, `R()`, `contract`,
   `interfaces`, `DEFAULTS`, `CMD`, `HANDLER`, `core`). Add an entry to the
   `RICH` interface map, a `RICH_NOTES` line (agent guidance), export it via
   `Object.assign(freeFlowExports, …)` — the manifest regex finds `CoreX: CoreX`.
2. **Register wiring before contracts are built.** Events need a `HANDLER`
   entry (an unmapped event name silently drops); unwired behaviour goes in
   `DEFAULTS[role]`; open/close style commands go in `CMD[role]`.
3. **Compile it in.** New source files must be appended in
   `scripts/ds-source.mjs` (js) and `scripts/build-ds.mjs` (css). Bump each
   system's minor version there, and the one asserted in `store.test.ts`.
4. **Example + tests.** Add documents to `richExamples()` in
   `src/packs/examples.ts` (feeds packs, starters, templates, goldens) and cases
   to `src/design-system/rich.test.ts`, which renders the *served* bundle.
5. **`npm run build:ds`**, then confirm acceptance counts and that a second
   run leaves `git status` unchanged.

## Safety rules for every block

- Numbers: pass every datum through `typeof n === "number" && isFinite(n)`;
  normalise by `max(|min|,|max|,1)` before subtracting so ±1e308 cannot make NaN;
  round with `r2`.
- Geometry attributes are computed numbers only. Data text goes in React
  children or `<title>`; colours come from a fixed token list (`SERIES`,
  `choice(...)`). Never spread data into attributes.
- A lone 100% donut slice cannot be an SVG arc (start = end); cap the sweep.
- Charts also render `dataTable()` (or real table cells) so nothing is visual-only.
- Overlays move focus in and restore it; Escape closes; backdrop click closes.
- Layout uses container-relative CSS (`@container`), not viewport media queries.

## Work-app and media patterns

- **State without a merge operator.** There is none, so a block that changes a
  collection (kanban) emits the *whole updated array* in its event and the
  default handler stores it as a local (`board`). Transient view state (sort,
  filter, page, expanded nodes, combobox query) stays in React `useState` and is
  not public.
- **Markdown and TeX are parsed into React elements**, never HTML. Links go
  through `passiveLink`, images through `imageSource`. Bound every loop (input
  length, depth, node counts) so a hostile document cannot hang the renderer.
- **Deterministic render.** No block reads the clock: calendar requires `month`.
- **Hooks first.** Call hooks before any early return (modal returns null when closed).

## Verify in a real browser

SSR tests cannot click. Start the dev server, publish a template with
`publish_kage` + visibility `public`, then drive headless Chrome over the
DevTools protocol (Node 22 has a global `WebSocket`). The dev store reseeds on
route recompiles, so publish and read the uuid in one command. Screenshots caught
real defects that SSR passed (list markers, stretched grid rows, `\left` text).

## Known limits

- Verified in a real browser in the light theme at desktop and 390px widths;
  dark theme relies on token inheritance (no hard-coded colours).
