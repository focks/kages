---
name: workspace-designs
description: "Workspace design definitions: named colour/type/radius overrides on a base system, chosen per Kage and pinned per version. Covers src/engine/design.ts, the store records, the set_design/set_kage_design operations, the renderer and the editor. Read before changing tokens, fonts, theming or how a Kage is dressed."
---

# Workspace designs

A design is a **skin on a base system** (core, ledger or atelier), not a new system: a new system needs a
contract for every block, a skin needs only the ~20 `--kg-*` variables components already read. Pure code is
`src/engine/design.ts`; storage is `src/store/designs.ts` + the `Store` methods; the ops are `list_designs`,
`get_design`, `set_design`, `delete_design`, `set_kage_design`; UI is `src/components/dashboard/designs` and
`/designs`; CLI is `kages designs`. User docs: `docs/designs.md`.

## The rules that keep it safe

- **Closed shape, never pasted.** `validateDesign` accepts only known roles, hex colours (re-serialised from parsed
  RGB), fonts looked up *by name* in the `FONTS` catalogue, and integer radii. `designCss` builds the stylesheet from
  that checked shape only, so no author text reaches CSS and the frame's CSP needs no change (Google Fonts is already
  allowed). Add a font by adding it to `FONTS` with the weights Google really serves: a weight a family lacks fails the
  whole stylesheet.
- **A snapshot is data too.** A stored `resolved.design` is rebuilt with `readSnapshot` (same checks) before it becomes
  CSS; a tampered one renders in the system's own look.
- **Complete in both themes.** A snapshot holds all 16 roles for light *and* dark. A light rule alone would leak a light
  colour into dark mode; the dark rule restates every role (`.dark .kg-kage.kg-design` out-specifies a system class).
- **Pinned per version.** `writeVersion` snapshots the design into `resolved.design`, like it pins design-system assets.
  Editing a design reaches a Kage only on its next version (`set_kage_design` re-applies). A deleted design keeps the
  previous snapshot so the Kage stays editable; an unknown id on a *new* reference is `not_found`.
- **Default design = new Kages only.** First version with no `design` field takes the workspace default; `design: ""`
  opts out and is dropped from the stored doc. An existing Kage never follows a changed default.
- **Contrast is advice, not a gate.** `set_design` saves a weak palette with a warning naming the failing pairs (the 21
  pairs in `contrast-pairs.json`, both themes); `paletteFromBrand` generates one that passes every pair (tested on
  nine colours including white, black and yellow). Do not turn this into a hard error: in-progress edits must save.

## Wiring a Kage to a design

`doc.design` is the id; `set_kage_design` patches `/design` (and `/system` to the design's base unless `keepSystem`).
The renderer reads `props.design ?? doc.resolved.design`. The editor passes a draft `design` (and `dark`) to
`KageRenderer`; the frame restyles in place on a `design` message (same React key, so state survives), it does not reload.

## Extending

- A new colour role: add to `COLOR_ROLES`, base palettes come from `public/ds/tokens.json`, add the role to
  `ROLE_GROUPS` (a test requires every role exactly once) and to `contrast-pairs.json` if it is text or a control.
- A new token kind (spacing, shadow): add it to the closed shape in `validateDesign`, to `resolveDesign`/`designCss`,
  to `readSnapshot`, and test hostile values first. Never accept a free-form CSS string.
- Arbitrary HTML blocks are deliberately **not** part of this. If ever added they belong in their own opt-in,
  nested-iframe block with no same-origin access, not in a design.
