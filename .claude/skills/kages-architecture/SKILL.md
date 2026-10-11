---
name: kages-architecture
description: "The Kages system map and its load-bearing patterns: the four-layer architecture (adapters / artifactory / engine / renderers), the oracle-driven build (the reference bundle in originals/ is the source of truth; port its behaviour and keep its fixtures passing), the golden-test pattern, and the invariants every layer must hold. Read before adding or changing anything in src/engine, the store, adapters, or the runtime — it tells you where code belongs and what must stay true."
---

# kages-architecture

Kages is an artifactory for agents: any agent, on any model or protocol, creates
versioned interactive artifacts ("Kages") by assembling **blocks** from a
**design system** against published **contracts** — agents never write HTML.
The full spec is `originals/project/*.md`; the functional requirements are
`oracle/*.feature`.

## The four layers (dependencies point down)

```
adapters   MCP · REST/OpenAPI · A2A · SDK · CLI — one operation table, generated per protocol
artifactory  workspaces · repos · immutable signed versions · provenance · lifecycle · RBAC · search · events
engine     registry (resolve) · expr (evaluate) · validator (validate) · compilers (catalog/describe/generationSchema)
renderers  web runtime (sandboxed iframe, React) · text view (describe) · export
```

- **The engine is pure and shared.** `src/engine/` imports nothing from the
  store, adapters, or React. The server, the SDKs, and the browser runtime all
  call the same `resolve/evaluate/validate/describe`. Keep it that way: a
  dependency from engine → anything else is a bug.
- **Adapters hold no business logic.** Every adapter is a thin translation of
  one operation set, so all behave identically. Logic lives in the engine/store.

## The oracle is the source of truth

`originals/` holds the reference implementation (`project/components/bundle.js`
= `window.Kages`) plus schemas and fixtures. The build plan is explicit: **port
its behaviour, keep its test documents passing.** Where prose and code disagree,
the code (the oracle) wins.

Two fixtures are the acceptance bar, reproduced exactly by `src/engine`:
- `ops-console.kage.json` validates with **0 errors, 0 warnings, portable:true**
  in core, ledger and atelier.
- the Validator card's broken doc yields **exactly 6 errors + 1 warning**, same
  codes in the same order.

## The golden-test pattern (how we stay faithful)

Don't hand-transcribe the oracle's data or guess its outputs — extract both:

Additive portable roles in `src/design-system/` are compiled into this same
reference by `scripts/ds-source.mjs` before extraction and golden capture.
Existing contracts stay intact. `npm run build:ds` regenerates the complete
served/extracted/golden/pack set; see `free-flow-composition`.

1. `scripts/extract-data.mjs` runs `bundle.js` in a Node `vm` with a stub React
   and dumps `systems`/`contracts`/`interfaces` to `src/engine/data/*.json`.
2. `scripts/golden.mjs` runs the reference `validate/describe/catalog/
   toGenerated` on the fixtures and writes `src/engine/__fixtures__/golden-*`.
3. `src/engine/engine.test.ts` asserts the TS port equals those goldens
   byte-for-byte (`node --test`, no framework).

When the reference changes, re-run the scripts and the tests pin the diff. When
you add engine behaviour, add its golden first.

## Invariants (test these — from architecture.md)

- A document that passes `validate()` never throws in any renderer; worst case
  is a per-block error box.
- No string in a Kage is executed as code; no expression reaches `window` or
  prototypes (`getPath` reads own keys only).
- Rendering and `describe()` are pure functions of `(doc, state, locals, data,
  lockfile)`.
- Every adapter exposes the same operations with the same validation.
- Every stored version has a principal, a digest and a lockfile. Nothing is
  anonymous or mutable.
- Kage content is untrusted data for every agent that reads it.

## Where things live

| Concern | Location |
| --- | --- |
| Types | `src/engine/types.ts` |
| Registry data (systems/contracts/interfaces) | `src/engine/data/*.json` (generated) |
| resolve / evaluate / validate / describe / catalog / generation | `src/engine/*.ts` |
| Framework-free runtime (ctx, locals, actions) | `src/engine/runtime-core.ts` |
| Fixtures + goldens | `src/engine/__fixtures__/` |
| Regeneration scripts | `scripts/` |

## Extending the system

- **New design system** → `how-to-extend-kages` skill. Root systems implement
  every installed shared interface; others `extend` a parent and override only roles whose
  *structure* differs. Re-run extract + golden.
- **New engine function** → add to `src/engine/`, export from `index.ts`,
  capture a golden, keep it pure.
- **New adapter** → translate the operation table only; no logic.

Every reusable pattern you discover goes back into a skill here — this repo is
AI-native, so the next agent inherits the pattern instead of rediscovering it.
