---
name: research-briefs
description: "Author a long, evidence-backed page (research brief, explainer, report) so it reads as trustworthy: contents rail, numbered citations to a references list, attributed quotes, captioned figures, highlighted code, a persisted self-check and a glossary. Read before writing or reviewing any page whose job is to make a sourced case."
---

# Research briefs

A brief earns trust by letting the reader check it. The blocks below make that cheap; the
order and the rules make it honest. The complete example is `research-brief` in
`contentExamples()` (`src/packs/examples.ts`); the user-facing page is `docs/research-briefs.md`.
For a chaptered handbook with a responsive rail and searchable evidence, read `field-guides` and use the `artifact-field-guide` starter.
For a page that ends in a calculator and a recommendation, use `decision-guide` instead.

## Shape (top to bottom)

1. **Hero** — `section` with `eyebrow` (topic, kind, date), a plain title and one-sentence thesis.
2. **Headline figures** — a `grid` of three `stat` blocks. Each caption names the source. Do not
   exceed three; a number a reader cannot hold is not a headline.
3. **Body in a `split`** — start: sticky `toc`; end: the sections. Put an `anchor` before every
   heading the `toc` lists (`toc-missing-anchor` fails otherwise).
4. **Sections in the order a sceptic asks**: what it is, where it came from, the evidence, the
   alternatives (a `table`), the practices, a worked example (`code`), the risks and poor fits,
   how to adopt it, a self-check, the glossary, the sources.
5. **Self-check** — `checkbox` blocks bound to state, one bound `stat` that sums them with
   `$if`/`$add`, a verdict `text`, and `persist` (`personal`) for every key.
6. **Glossary** then **references** last.

## Cite everything that is a claim

- Sources live in one `references` block, **in order of first citation**; ids are short slugs.
- A claim carries a run `{text: "<position>", cite: "<id>"}`. The text is the item's number.
  `dangling-cite` (P2) fails on an unknown id or a number that disagrees with the list.
- A number, date or named result with no citation is a claim without a source; `unsourced-claim`
  and `stat-literal-unsourced` flag the figures (see `rich-artifacts`). Cite or label illustrative.
- Prefer the primary source. Link the page you read, not a search. Put the organisation in `detail`.
- State limits where they apply ("associated with higher burnout"): a brief that only agrees with
  itself is a pitch. Say what the evidence does not show.

## Quotations

Use a quote node with `attribution` (who, and on what) and `href` when there is a page. The
attribution renders under the quotation in a `figcaption`, never inside it. Quote sparingly: one
per brief, when the wording is the point.

## Figures

- `caption` is the sentence under the figure and states **the takeaway**, not the title. `label`
  stays the accessible name and should describe what is drawn.
- Branch or lane diagrams: draw with `scene` (`line` for the trunk, `path` curves for branches,
  `circle` commits, `text` lane names) in a 640 × 200 space. `diagram` layers directed graphs by edges, reflows vertically on phones, and uses a grid for cycles; it does not draw arbitrary lanes. Colours are tokens only (`accent`, `ink`, `ink-muted`, `success`, `danger`).
- Reuse one colour per meaning across every figure and the page (trunk = accent, risk = danger).
- Wide figures must stay legible at 390 px; `kages screenshot --width 390` reports small text.

## Code

`language` colours keywords, strings, numbers and comments (js, ts, json, sh, py, yaml, sql, the C
family). Show the smallest listing that makes the point and say what it demonstrates in `caption`.
Colour is decoration: never rely on it, and never put a secret in an example.

## Craft that makes it read as designed

Hold one type pairing and one reading width; use rules and space instead of a box around every
section (`nested-sections`); keep tables to ≤ 5 columns; give lists real structure (`list`,
`timeline`, `stepper`) rather than paragraphs; keep paragraphs under about five lines. Systems own
fonts and tokens, so do not try to add them: pick the system that fits (Atelier for editorial,
Ledger for dense tables).

## Verify

`kages lint` (zero findings), `kages screenshot --width 390` and `--dark`, and
check every link with the keyboard: Tab to a citation, Enter, and land on its source.

## Extending the blocks

Citation runs and attributed quotes live in `src/design-system/expressive.js` (`richRuns`,
`CoreRichText`), `glossary`/`references` in `content.js`, the tokenizer in `free-flow.js`
(`highlightCode`). Follow `rich-artifacts` for the recipe. The tokenizer must stay a single linear
scan over React text children, with every pattern tolerating an unterminated token and the input
capped; its tests include a pathological input. Token colours use the pairs in
`contrast-pairs.json` (accent and success on sunken).
