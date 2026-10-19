---
name: expressive-artifacts
description: "Extend or maintain dynamic collections, safe computation, reusable document-local compositions and expressive visual blocks. Covers the shared oracle/engine source, instance identity, lexical item scopes, generation and immutable version pins."
---

# Expressive artifacts

Read architecture, testing conventions, comment doctrine and free-flow composition
first. Requirements live in `oracle/expressive-artifacts.feature`.

## One capability implementation

`src/engine/advanced.js` is pure shared source: computation, ephemeral expansion
and additive validation. `scripts/ds-source.mjs` injects its export-free bytes into
the oracle closure. `src/design-system/advanced-oracle.js` extends reference
operations; `src/design-system/expressive.js` and `.css` add installed contracts.
The pure TS port consumes the same capabilities. Never hand-edit served assets,
registries, goldens or generated agent packs. Run `npm run build:ds`, capture a
golden before tests for new behavior, and retain original acceptance counts.

## Runtime identity and scope

`materialize()` expands a template document into a temporary tree. Stored block
ids and signatures stay intact. Instance ids combine the template id, enclosing
repeat keys and composition placement. Encode dots as well as URL delimiters:
`$block` separates id from output at the first dot. String and numeric keys stay
distinct; missing or duplicate keys fail closed. Without a key, array position is
the identity. Bound expansion to 10,000 blocks and a nesting depth of 64.

Initialize missing instance locals from their contracts, then overlay retained
locals. Keep locals for filtered-out items so restoring a filter restores edits.
Reorder by key, never by positional React keys. Scope event handlers, command
targets and sibling output references with the same map as the rendered subtree.
Reject references from outside a repeat into its ambiguous template. A repeat
belongs inside an unbounded container when the containing slot has a maximum.

`$item` is lexical: a nested repeat or `$map.to` owns its item; named outer rows
remain accessible with `$scope`. `$index: ""` is the repeat position. Replacing
item/input expressions uses `$literal`, which must stay opaque to evaluation and
expression walking. Dataset values with operator-looking keys are still data.

## Reusable compositions

`doc.compositions[name]` contains typed `inputs`, `root`, `blocks`, optional
`output` and `outputType`. A `composition` block chooses the definition through
`props.name` and passes `props.inputs` or `bind.inputs`. Definitions read `$input`;
callers read the public `value` output. Validate every definition, even unused or
inside an empty repeat. Check defaults, unknown/missing inputs, output references
and type, and definition cycles. Resolve input expressions against controls in
the same enclosing scope. Version lockfiles also pin `compositions/name/block`;
expansion carries those pins to concrete instances. Any patch diff must include
compositions; collaborative merges treat definition edits as structural /root
edits, and store claim checks cover /compositions paths. Otherwise a concurrent
save can discard a definition edit even though local preview shows it.

## Computation and interfaces

Arithmetic takes finite numbers without coercion; domain errors, division by zero
and overflow yield null. Sorting copies its input and uses original position for
ties. Formatting is en-US/UTC, with explicit offset ISO timestamps or date-only
strings. Describe, generation, headless preview, React and oracle rendering must
agree. Generation includes nullable `repeat_json` and `compositions_json`; old
envelopes still parse. Expression-bearing strict props migrate into bindings
without losing formulas.

Visual blocks whitelist geometry and token paints; never spread data into SVG
attributes. Rich text constructs React nodes; links whitelist passive schemes.
Charts expose a data table, and interactive shapes support Enter/Space. Register new event names in the oracle
`HANDLER` table before building their contracts; an undefined handler prop silently
drops events. Test every event has a named handler. Native
forms report validity before submit and emit string values (duplicate names form
arrays); numeric field change emits number/null. Check actual keyboard and
browser behavior as well as SSR, both themes and all systems.

The New Kage starters (`src/packs/starters.ts`) use the same examples as packs and workspace seeding.
New artifacts save through `/api/create_kage`; existing edits use `/api/patch_kage`.
Run typecheck after a Next build, since the build rewrites `.next/types`.

## Operators and handlers beyond the reference

`$floor/$ceil/$abs`, `$join`, `$truncate`, `$format` (compact, relative) live in `src/engine/advanced.js`
beside the other computation, so the oracle and the pure engine share them; add each to
`COMPUTE_OPERATORS` and `computationArgError`, and to `CASES` in `src/engine/parity.test.ts`, which
evaluates in both. A `set`/`toggle` path may be an expression (`actionPath`), and `watch` handlers run
through `watchedActions` after the transaction (`runWatchers`, four passes). The oracle's own `runActions`
and dispatch are patched in `scripts/ds-source.mjs`; if those anchors move the build fails loudly.
Nothing may read the clock: a relative date takes an explicit `relativeTo`.
