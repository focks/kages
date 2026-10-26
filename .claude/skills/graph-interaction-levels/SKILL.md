---
name: graph-interaction-levels
description: "Choosing how alive a graph should be — static, interactive, or explore — and how version pins in block types actually work. Read before setting interactive or explore on any diagram or chart, and before pinning a contract version."
---

# Graph interaction levels

Not every graph needs to be interactive. A diagram or chart is a sentence in
the page's argument, and most sentences only need to be read. Interactivity is
a cost — wiring, chrome, a promise to the reader that clicking does something —
so each level must earn itself.

## The ladder

| Level | Reach for it when | What it requires |
| --- | --- | --- |
| **static** (the default) | The picture explains itself; the `caption` carries the takeaway. | Nothing. This is most diagrams. |
| `interactive:true` | The selection *drives another block*: a detail panel, a filtered grid, a recolored section. | Bind `selected` to state, handle `select`, and make the consequence visible next to the graph. |
| `explore:true` | Nine or more nodes, or named `group`s worth collapsing; readers will genuinely search, zoom and trace. | Everything above, plus meaningful groups when grouping applies. |

Two rules of thumb:

- **Start static and climb only with a reason.** "It could be clickable" is not
  a reason; "the reader needs to compare what each node does" is.
- **One focal interaction per region.** A stepper and a diagram synced through
  one state key count as one interaction; a page where every figure is
  clickable has none that matter.

The engine enforces the floor, so `kages validate` is the arbiter:

- `selection-unused` (P2): an `interactive`/`explore` graph whose selection
  nothing reads. The first fix it offers is to make the graph static.
- `needless-explore` (P3, deep): `explore:true` on eight or fewer ungrouped
  nodes — search/zoom/fit chrome outweighs a graph that small.

The same bar applies to selectable charts (`donut-chart`, `heatmap`,
`funnel-chart`, `treemap`, `map`): set `interactive` only when the selection
filters or drives something, and say so in the caption.

## How version pins really work

A block `type` accepts `name`, `name@major[.minor]` and `system/name@major`
(src/engine/resolve.ts):

- **A version suffix asserts, it does not select.** `diagram@1` validates
  against the installed contract and fails loudly if the major ever moves.
  Pin majors on documents meant to outlive the system, so drift surfaces as a
  validation error instead of a silent re-render. You cannot reach an older
  implementation this way — new saves always resolve to the head, and only
  existing signed versions keep their pinned bundle.
- **A cross-system pin selects an implementation.** `core/dropdown@1` inside a
  Ledger Kage lands on core's own dropdown with core's limits (the 40-option
  listbox instead of Ledger's 6-segment control). Use it when the host system's
  version of a role is the wrong tool, not to change its look.

So "give me the simpler diagram" is never an older version: the head contract
is all the levels in one block, and the simple diagram is the same `diagram`
with the chrome left off.
