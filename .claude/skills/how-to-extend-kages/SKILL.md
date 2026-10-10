---
name: how-to-extend-kages
description: "Step-by-step recipes for the three scalable extension points in Kages: add a design system, add a component (contract + implementation), and add a protocol adapter. Each recipe lists the files to touch, the conformance bar to clear, and the golden/extract step to re-run so the engine stays faithful. Use when asked to add a system, component, role override, or adapter."
---

# how-to-extend-kages

Three things scale out in Kages. Each has a fixed recipe; follow it so the next
agent's change looks like the last one. Read `kages-architecture` first.

## Add a design system

A system is **a token set plus a role map**; it may `extend` a parent.

1. **Manifest** (`*.design-system.json`): `id`, `version`, `scope`
   (`kg-sys-<id>`), `extends` (`"core@1"` or `null`), and a `components` map
   listing **only the roles you own**. Inherited roles fall through to the
   parent automatically — do not relist them.
2. **Tokens**: define all 16 colour roles under your prefix, then type/radii/
   shadows. Contrast bar: text ≥ 4.5:1, `line-control` ≥ 3:1, light and dark.
3. **Scope CSS**: map your prefix onto `--kg-*` under `.kg-sys-<id>`.
4. **Override only structural differences** (e.g. Ledger's dropdown is a
   segmented control, not a restyled listbox). Restyle everything else through
   the scope — no new component.
5. Each override gets a **contract** that `implements` its interface, plus
   extension props, `limits`, and `agent` use/avoid notes.
6. **Conformance**: every interface event fires with the declared payload;
   every command works; `outputs` match; `ops-console` renders with zero
   runtime errors in light and dark. A root system must implement all 12
   interfaces.
7. Re-run `scripts/extract-data.mjs` then `scripts/golden.mjs`; the engine tests
   pin the new data. If the bundle's `public/ds/tokens.json` changed, also run
   `npm run tokens` to regenerate `public/ds/tokens.css` (the `.kg-kage`-scoped
   sheet the viewer/studio/preview load) — see `kages-app-design-system`.

## Add a component / role override

The **contract is the only thing an agent sees** — if it isn't declared, a block
can't use it (no unlisted props, no styling, no internals).

1. Write the contract (`kages.contract/1`): `implements` an interface (cover
   every interface prop/event/output/command with compatible types), `props`
   (JSON-schema subset), `slots`, `local` (block-owned state), `outputs` (the
   only public reads), `events`, `commands` (other blocks' only write path),
   `defaults` (run before the block's own handlers so it works unwired),
   `limits` (validator *warnings*), `tokens`, `agent`.
2. Implementation reads `--kg-*` only; owns its ARIA/keyboard model.
3. **Versioning**: add optional prop/output/event/command/slot → minor; visual
   only → patch; remove/rename/require/narrow-enum/change-payload/change-
   implements → **major**. `ref` is immutable once published.
4. Re-extract + re-golden.

## Add a protocol adapter

One operation set (`list_systems`, `get_catalog`, `get_contract`,
`search_kages`, `get_kage`, `describe_kage`, `create_kage`, `patch_kage`,
`generate_kage`, `validate_kage`, `preview_kage`, `publish_kage`, `share_kage`,
`export_kage`, `get_state`, `subscribe`, `claim_blocks`, `release_blocks`,
`comment`).

1. Implement the operation table **once** (server-side, over the store +
   engine). The adapter is a pure translation of it — **no business logic, no
   divergent validation**.
2. Generate the adapter surface from the table: REST+OpenAPI (the file doubles
   as function-calling tool defs), CLI, MCP tools/resources, A2A agent card
   (`skills: build-kage, revise-kage, describe-kage`).
3. Test the *same task* succeeds identically through every adapter — that
   equivalence is the adapter contract.

## The one rule that keeps it scalable

Behaviour lives in the engine and store; everything else is generated or
translated from them. If you're tempted to put logic in an adapter, a component,
or a UI, it belongs one layer down — and the pattern you just used belongs in a
skill here.
