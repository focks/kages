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

## Plan, then commit (patching)

`Store.patch` is `candidateOf` (apply or three-way merge, reads only) then `writeVersion`
(the only side effects: quota tick, audit, event, signature). `Store.checkPatch` reuses
`candidateOf` and `claimBlock` so `validate_patch` can promise the same verdict with no
writes; `validate-patch.test.ts` proves it differentially and with a before/after
fingerprint of the whole snapshot. Keep any new write-path check in those shared helpers, or
the dry run and the real patch will drift apart. `applyPatch` errors carry the failing op's
index (`op 1 (remove /blocks/x): …`).

## Rendering trust boundary

Read `artifact-sandbox` before changing the runtime, asset pinning, screenshots, or discussion geometry. Signed documents pin content-addressed design assets and the browser runtime; legacy versions without pins use the current assets until a new version is saved. Never claim those legacy bytes are reproducible.

## Write classification and process-wide limits
- `OpSpec.write` may be a function of the params (`tune_kage`, `migrate_kage`: write only with `apply:true`). Always ask
  `isWriteOp(op, params)`: a planning call routed through `mutateStore` commits a snapshot and is refused to anonymous readers.
- Counters that must hold across requests but must not turn a read into a write live in process memory, not on the `Store`
  instance (a persistent deployment restores a fresh one per request): see `Store.dryRunTimes`. Say "per server" in the message;
  tests call `Store.resetDryRunLimits()`.
- Acknowledge a public write only from `mutateStore`'s returned result (`src/server/guest-feedback.ts`), never from the last
  in-memory attempt.

## Security invariants (see oracle/security.feature)
- Identity: `authMode()` (src/server/auth-mode.ts) is `supabase`, `local` (explicit: `next dev` or `KAGES_LOCAL_MODE=1`) or `closed`.
  Never add a code path that grants the demo admin outside `local`.
- Anything that lists or streams Kages (events, search, history) must filter through read permission per item (`canSeeEvent`,
  `canAccess`); an older version also needs the current head to be readable (`authorizeRead(name, author, version)`).
- Browser writes pass `crossSiteWrite` (src/server/web-safety.ts); redirects taken from input pass `safeNext`; fetch allowlists use
  `urlAllowed` (parsed origin + whole path segments). Never `startsWith` on a URL or `${origin}${input}`.
- Rolling limits that must hold across requests live in the snapshot (`limits`) or, for reads, in process memory; never only on an instance.
- Dependencies: `shadcn` (a scaffolding CLI) is a devDependency; `overrides` pins next's postcss. Re-run `npm audit --omit=dev`.
- Existence is not leaked: `concealPrivate` (operations.ts `dispatch`) turns a `forbidden` for a Kage the caller cannot read into the same
  `not_found` a missing Kage gives; `anon-sweep.test.ts` calls EVERY operation as an anonymous caller and checks both no content and no
  existence difference. A new operation is covered automatically; give it plausible params in `paramsFor` if it needs unusual ones.
  In a store method, check existence/readability before identity (`addComment`).
- Comment mode is one component, `CommentStage`, over a `CommentsApi`: owners use `useComments`, visitors `useGuestComments`
  (add-only; `api.guest` hides replies, votes and the resolved toggle). Do not fork the stage for a new audience; give it another api.
