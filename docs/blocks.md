# Blocks

Every Kage is a tree of blocks, and a block is the unit an agent assembles instead of writing HTML. This page groups the block types and shows how to read the authoritative contract for any one of them.

## How a block is described

A block has a `type`, optional `props`, and may expose `slots` (named places for child blocks), `events` (things a person does), `outputs` (values other blocks can read) and `commands` (actions other blocks can trigger). A block never carries colour, padding or pixel sizes: appearance belongs to the design system, and layout is set with semantic props and spacing steps (`gap: 0` through `8`). That rule is what lets the same document render in Core, Ledger or Atelier.

## Finding the full catalog

The type list below is a map, not the contract. The generated catalog is the source of truth for every prop, slot, event and output, and it never drifts from the validator.

```sh
kages catalog core           # every block in a system, with props and guidance
kages contract core/card@1.0.0   # the full contract for one block
kages schema core            # the JSON Schema a model fills to generate a Kage
kages system card core       # the system's tokens, rules and known issues
```

## Layout

These hold the page together: `page`, `section`, `stack`, `grid`, `split`, `card`, `shell`, `sidebar`, `divider`.

| Block | Purpose | Key props |
|-------|---------|-----------|
| `page` | The root canvas | `width` (reading, wide, full), `gap` |
| `section` | A titled region | `title`, `level` (2–4), `tone`, slots: children, actions |
| `stack` | A row or column | `direction`, `gap`, `columns`, `align`, `wrap` |
| `grid` | A responsive equal-column grid | `columns`, `minSize`, `gap` |
| `card` | A container for one topic | `title`, `subtitle`, slots: children, actions |

## Text and content

For prose and figures: `text`, `rich-text`, `markdown`, `code`, `code-tabs`, `image`, `link`, `list`, `toc`, `anchor`, `glossary`, `references`, `badge`, `math`.

| Block | Purpose | Key props |
|-------|---------|-----------|
| `text` | One run of type | `text` (required), `variant` (display, title, heading, body, muted, caption, code) |
| `stat` | One headline number | `label`, `value`, `format`, `delta`, `caption` |
| `code` | A code sample, coloured by `language` | `code`, `language`, `caption`, `wrap`, `highlight` |
| `rich-text` | Headings, paragraphs, quotes and lists | `nodes`; runs take `bold`, `italic`, `code`, `href`, `cite`; a quote takes `attribution` and `href` |
| `glossary` | Terms and their meanings | `title`, `items` (term, definition) |
| `references` | The numbered sources a page cites | `title`, `items` (id, label, href, detail) |

See [research briefs](research-briefs.md) for how citations, quotes, captions and a glossary fit together.

## Data and charts

For records and visuals: `table`, `data-grid`, `stat`, and charts `bar-chart`, `line-chart`, `scatter-chart`, `area-chart`, `donut-chart`, `combo-chart`, `stacked-bar-chart`, `funnel-chart`, `treemap`, `sankey`, `heatmap`, `gauge`, `sparkline`, `map`.

| Block | Purpose | Key props |
|-------|---------|-----------|
| `table` | Rows under typed columns | `columns` (required), `rows` (required), `empty`, `dense`; event: rowSelect; output: rows |
| `data-grid` | A larger, filterable table | `columns`, `rows`; filtering built in |
| `bar-chart` | Labelled bars | `items` (required: label, value), `format` |

Charts bind their `items` to a list expression such as `$map` or `$filter`, so a filter control reshapes the chart. Every chart ships an accessible data table alongside it.

## Inputs and forms

For gathering values: `form`, `text-field`, `text-input`, `number-input`, `textarea`, `select`, `dropdown`, `combobox`, `multiselect`, `choice`, `checkbox`, `switch`, `slider`, `date-input`, `date-range`, `file-upload`, `button`.

| Block | Purpose | Key props |
|-------|---------|-----------|
| `button` | Trigger one action | `label` (required), `variant` (primary, secondary, quiet, danger); event: click |
| `form` | A native validated form | `label`, `submitLabel`; event: submit (values); slots: children |
| `text-field` | Single-line text | `label`, `placeholder`; output: value; event: change |

A form validates in the browser and emits named values on submit; a numeric field emits a number or null. Choices from a known list use a `select` or `choice`, never a pair of buttons.

## Disclosure and overlay

For revealing detail on demand: `accordion`, `tabs`, `tab-panel`, `modal`, `drawer`, `stepper`, `timeline`, `carousel`, `tree`, `kanban`, `calendar`, `gallery`, `alert`.

| Block | Purpose | Key props |
|-------|---------|-----------|
| `tabs` | Switch sibling views | `tabs` (id, label), `value`; event: change; output: value |
| `accordion` | Collapsible panels | `items` (id, title, body); output: value |
| `modal` | An overlay dialog | `label`, `open`; commands: open, close, toggle |

## Structure

Three blocks shape the tree itself rather than draw anything. `repeat` renders a block once per row of a list, `composition` places a reusable typed sub-tree, and `conditional` shows a block only when an expression is true. All three are covered in [expressions and data](expressions.md).

## Systems and inheritance

Core defines every block. Ledger and Atelier extend Core and override only how a handful of blocks look — a `button` or a `card` is the same block with a denser or softer skin. Because the document is the same in all three, a Kage authored in Core renders in Ledger or Atelier without change. See [design systems](design-systems.md) for what each one is for.
