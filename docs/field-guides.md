# Chaptered field guides

Kages can now build an editorial guide with a numbered chapter rail, mobile
chapter menu, previous/next links, a theme switch, and expandable evidence.
The `artifact-field-guide` starter combines these with existing diagrams,
checklists, filters, code tabs, scenario selection and source references.

The reference site already used valid Kage data, but rendered it with custom
website code. The new blocks make its useful patterns reusable in the normal
Kages renderer. The shipped starter uses original authoring examples; private
research content is not bundled or published.

## Guide structure

```json
{
  "type": "guide",
  "props": {
    "title": "Operating guide",
    "mark": "g.",
    "palette": "mint",
    "chapters": [
      { "id": "overview", "label": "Overview" },
      { "id": "evidence", "label": "Evidence" }
    ]
  },
  "bind": { "value": { "$state": "chapter" } },
  "on": { "change": [{ "do": "set", "path": "chapter", "value": { "$event": "id" } }] },
  "slots": { "children": ["overview", "evidence"] }
}
```

Initialize `state.chapter` to `overview`. Each child chapter uses
`visible: {"$eq": [{"$state":"chapter"}, "<chapter-id>"]}`. Navigation preserves
other state; the new chapter receives focus and starts at the top. Up to 40
unique chapter slugs are supported. Set `themeToggle:false` to hide the theme
control. A theme choice affects the artifact frame only.

Dedicated preview and shared pages support links such as `#evidence` and browser
Back/Forward. Embedding the same guide in the Library does not take over the
Library URL. A host can explicitly opt into this behavior through the renderer's
`navigation` prop. URL routing requires a root `guide` with static chapter props;
nested guides and dynamically bound chapter lists use local navigation.

## Evidence entries

Use `disclosure` with `title`, `eyebrow` (topic), `badge` (evidence status), and
optional palette. Its `children` slot accepts normal rich-text, code, links and
other blocks. It opens with native keyboard/mouse behavior; `open` is public and
`change` emits `{open}`. No handler is required for basic expansion.

Repeat the block over a filtered dataset with a stable key. Show the result
count, an explicit empty state and clear/reset. Keep critical warnings visible;
optional supporting detail belongs in a disclosure. Label observations,
recommendations and unverified reports honestly.

## Verification

The example and new contracts are validated against the compiled oracle in
Core, Ledger and Atelier. Tests play chapter navigation, checklist/reset,
combined filters, empty results, restored disclosure identity and scenario/map
choices. Browser tests cover the actual preview/shared routes with local fixture
reads, including deep links, Back/Forward, focus, mobile menu, theme and scrolling.

```sh
npm run dev -- --port 3100
KAGES_TEST_URL=http://localhost:3100 KAGES_CHROME_NO_SANDBOX=1 node --test src/runtime/guide-browser.test.ts
node bin/kages.mjs screenshot public/ds/artifact-field-guide.kage.json --width 390,1440 --out /tmp/guide-review/ --url http://localhost:3100
```

This is chapter navigation inside one Kage, not a general website router. State
and theme persist while the artifact remains open; reload persistence is not
implied. Old signed versions keep their pinned component/runtime assets and
need a new revision to use the new blocks.
