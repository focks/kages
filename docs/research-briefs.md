# Research briefs

A research brief is a long page that makes a case from evidence: a definition, the data behind it, a comparison, the risks, and a way for the reader to check their own situation. This page shows the blocks that make one read as trustworthy, and the order that works. For a brief that ends in a calculator and a recommendation, use a [decision guide](decision-guides.md) instead.

## What a good brief has

| Part | Block | Why it is there |
|------|-------|-----------------|
| Headline figures | `grid` of `stat` | The three numbers a reader should leave with, each with its source in the caption |
| Contents | `toc` (sticky) with `anchor` before each heading | A long page is navigated, not scrolled; the current section is highlighted |
| Claims with sources | `rich-text` with `cite` runs | A numbered link from the sentence to its source |
| A quoted voice | `rich-text` quote with `attribution` | Says who said it, outside the quotation |
| Figures | `scene`, `diagram`, `table` with a `caption` | The caption states what to take from the figure |
| Code | `code` with a `language` | Keywords, strings and comments are coloured |
| A self-check | `checkbox` blocks, a bound `stat`, `persist` | Ticks add up to a score and are kept in the reader's browser |
| Terms | `glossary` | Definitions in one place, at the end |
| Sources | `references` | The numbered list the citations point to |

## Cite a claim

Put the sources in a `references` block, in the order they are first cited. Each item has an `id`, a `label`, and an `https` link. In prose, add a run whose `text` is the item's number and whose `cite` is its `id`.

```json
{ "type": "rich-text", "props": { "nodes": [
  { "kind": "paragraph", "runs": [
    { "text": "Teams that merge daily deliver faster" },
    { "text": "1", "cite": "dora" },
    { "text": "." } ] } ] } }
```

```json
{ "type": "references", "props": { "title": "Sources", "items": [
  { "id": "dora", "label": "Capabilities: Trunk-based development",
    "href": "https://dora.dev/capabilities/trunk-based-development/", "detail": "DORA" } ] } }
```

The number renders as a superscript link that jumps to the source. `kages lint` reports a `dangling-cite` when the id has no source or the number disagrees with the list, so a reader never lands on the wrong reference.

## Attribute a quotation

A quote node takes an `attribution` and an optional `href`. The attribution is shown under the quotation, outside it, as the HTML specification recommends.

```json
{ "kind": "quote", "text": "If it hurts, do it more often.",
  "attribution": "Martin Fowler on integration frequency",
  "href": "https://martinfowler.com/articles/branching-patterns.html" }
```

## Caption every figure

`scene`, `diagram`, `code` and `image` take a `caption`. For a `scene` or `diagram` the `label` stays the accessible name and the `caption` is the visible sentence under the figure. Write the caption as the point of the figure ("Branches rejoin within a day"), not its title.

## Colour code

Set `language` on a `code` block and keywords, strings, numbers and comments are coloured. Supported: `js`, `ts`, `json`, `sh`, `py`, `yaml`, `sql`, and the C family (`go`, `rust`, `java`, `c`, `cpp`, `cs`, `kotlin`, `swift`, `php`). Any other language is shown plain. Highlighting never changes the text, and `highlight: false` turns it off.

## Keep the reader's ticks

A self-check is a set of `checkbox` blocks bound to state, with a `stat` that adds them up. Declare the keys in `persist` as `personal` and the ticks survive a reload in that reader's browser only.

```json
{ "state": { "c1": false, "c2": false },
  "persist": { "c1": "personal", "c2": "personal" } }
```

## Check your brief

Run `kages advice` and `kages lint` on the document. Then open it at phone width with `kages screenshot --width 390`: the contents rail should stack above the text and wide figures should scroll sideways. The starter named "Trunk-based development — a research brief" uses every block above.
