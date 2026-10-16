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

## Connected blocks (batch 3)

- **Selection.** Interactive charts (`donut-chart`, `heatmap`) emit `select` and
  expose a public `selected` output; clicking the same slice toggles it off. A
  second block filters with `{ $filter: { list, field, equals: { $block: "chart.selected" }, skipIf: "" } }`.
  Only *outputs* are readable across blocks — a prop like a grid's `rows` is not
  (`private-output`). Bind both sides to state or repeat the expression.
- **Live data.** `HostBridge.load(source)` is the only network path. The host opts
  in with `<KageRenderer host={{ fetchAllowlist: [...] }}>`; with no allowlist every
  fetch is denied and the action's `mock` lands instead, so previews stay offline-safe.
  Never add a second fetch path or relax the https/no-credentials/size rules.
- **Conditional rules** need no new engine surface: `visible`, bound `disabled`,
  action `when` and `$if` already cover them. Guard both the control state *and*
  the action, since an event can arrive without the button being clickable.
- A new contract event/output on an existing role is a minor contract bump
  (`donut-chart` and `heatmap` are 1.1.0).
- **After every `build:ds`, re-read the example goldens** for errors: the oracle
  validator misses things the pure engine catches (e.g. `$tpl` hides block reads).
  `connected.test.ts` validates every example with the pure engine in all systems.

## Verify in a real browser

SSR tests cannot click. Start the dev server, publish a template with
`publish_kage` + visibility `public`, then drive headless Chrome over the
DevTools protocol (Node 22 has a global `WebSocket`). The dev store reseeds on
route recompiles, so publish and read the uuid in one command. Screenshots caught
real defects that SSR passed (list markers, stretched grid rows, `\left` text).

## Known limits

- Verified in a real browser in the light theme at desktop and 390px widths;
  dark theme relies on token inheritance (no hard-coded colours).

## Wide figures on phones

Charts and diagrams are drawn in a fixed coordinate space and scaled to fit, so on a
phone their text shrinks with them. Any figure whose viewBox is 480+ wide gets
`kg-scene--wide` and `style={{ minWidth: 0.8 × width }}` (`wideStyle()` in
`expressive.js`) inside a figure that scrolls sideways, which keeps labels at ~9px+.
New wide charts must do the same; `kages screenshot --width 390` reports
"text is too small to read" if one forgets (see `visual-review`).

## Adding a lint rule (`src/engine/rules/`)

A rule is one file exporting a `Rule` (`id`, `category`, `severity` P0–P3, `tier`
immediate|deep, optional `modes`, `summary`, `rationale`, pure `check(ctx)`), one
line in `rules/index.ts`, and a `{pos, neg}` entry in `rules/fixtures.ts` — the
registry test fails without it. `ctx` (`buildContext`) already holds blocks,
actions, reads, `tplRefs`, reachability, state keys, mode and `outputsOf(type)`,
so a rule never re-walks the document. Defaults: wiring that breaks the task is
P1, quality P2, style P3. Output is sorted by severity then location, so rule
order never matters. Waivers live in `doc.meta.kages.lint.ignore` as
`[{rule, block?, reason}]` (reason ≥ 8 chars; a bad waiver is itself a `bad-waiver`
P3 finding and waives nothing); workspace-wide `lint.ignoreRules` is in config.
A mode-gated rule is skipped when the Kage's mode is unknown. The shipped corpus
must stay at zero findings.

### Flattening `nested-sections`

A *container* is a `card` or a `section` with tone surface/sunken/accent; a plain section is
only spacing and a heading. To fix a finding, make the outer section plain (omit `tone`) or
drop the inner card; group with heading level and `gap` instead. Overlays (`modal`) and
`shell` regions start a fresh context, and a composition is analysed on its own. The limit
is one level for every system (`MAX_DEPTH` in the rule); waive a dense data pane with
`meta.kages.lint.ignore` and a reason rather than raising it.

## Writing claims honestly (`unsourced-claim`, `stat-literal-unsourced`)

Deep-tier, advisory rules (`kages lint`, `get_context`'s `UNSOURCED_CLAIMS`): a figure with
a benefit cue ("cut costs by 40%"), a reach count ("trusted by 500+ teams"), a superlative
(P3) or a quoted testimonial, and a `stat` whose value is typed in. By mode: persuade and
experience check everything, read only testimonials, operate only literal `stat` values; an
unknown mode checks testimonials alone. To resolve one: bind the value to data, add
`{claim, source}` (or `{block, source}`) to `doc.brief.evidence` (a free-form note is not a
source), label the page illustrative (figures and reach only, never testimonials), or remove
it. A workspace brief that lists testimonials under `absent` makes a testimonial P1. Prose
extraction (`rules/prose.ts`) skips chart series, table cells, code, bound props and ids.
English-first by design; tune patterns in `claim-patterns.ts` and add the sentence that
misfired to `claims-calibration.test.ts`.

## Browser surfaces and motion (`surfaces.css`, `motion.css`)

Two additive sources appended last by `build:ds`: **surfaces.css** themes what browsers draw
(selection = 22% accent, caret, accent-color, placeholder, `li::marker`, link underline offset,
thin visible tab-strip scrollbars, tabular numerals on counts, forced-colors) and **motion.css**
holds the one global reduced-motion rule (`!important`, scoped under the Kage root, must stay
the last motion rule). `color-scheme` is emitted per theme by `scripts/kage-tokens.mjs`. Motion
tokens (`--motion-duration-fast|base|slow`, `--motion-ease-out|inout`) are in `tokens.json`.
Rules for new CSS: scope everything under `.kg-kage`/`.kg-sys-*` (never `:root`, `html`, `body`
or `*`), use motion tokens (`checkMotion` fails literal timings, overshoot easing, `infinite`,
`steps()` and `@keyframes`), and never remove an outline without replacing it. The reference
stylesheet is frozen: its four transitions are an accepted inventory and the global rule
neutralises them. `node scripts/audit-surfaces.mjs` lists remaining gaps; the static tests and a
Chrome-gated computed-style test (`surfaces-browser.test.ts`) enforce the rest.
