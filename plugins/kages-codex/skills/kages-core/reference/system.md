---
system: core
version: 1.17.0
tokens:
  colors:
    paper: { light: "#f4f2ec", dark: "#141513" }
    surface: { light: "#fffdf8", dark: "#1c1e1b" }
    sunken: { light: "#ebe7de", dark: "#232521" }
    line: { light: "#dcd6ca", dark: "#343730" }
    line-control: { light: "#857e6f", dark: "#7f8377" }
    ink: { light: "#1c1d1a", dark: "#edebe4" }
    ink-muted: { light: "#595b53", dark: "#a6a89e" }
    accent: { light: "#9c4a17", dark: "#e6904f" }
    accent-ink: { light: "#fffdf8", dark: "#1c1208" }
    accent-soft: { light: "#f3e2d2", dark: "#3b2818" }
    wire: { light: "#1f6a70", dark: "#6cc0c4" }
    wire-soft: { light: "#d9ecec", dark: "#173537" }
    success: { light: "#2f6b45", dark: "#7cc493" }
    danger: { light: "#b0281f", dark: "#f0857b" }
    danger-soft: { light: "#f8dcd8", dark: "#3f1d1a" }
    focus: { light: "#1f6a70", dark: "#6cc0c4" }
  type:
    core-display: { family: display, size: 40px, line: 44px, weight: 700, tracking: -0.02em }
    core-title: { family: display, size: 22px, line: 28px, weight: 650 }
    core-heading: { family: sans, size: 16px, line: 22px, weight: 600 }
    core-body: { family: sans, size: 14px, line: 20px, weight: 400 }
    core-label: { family: sans, size: 12px, line: 16px, weight: 500, tracking: 0.01em }
    core-code: { family: mono, size: 12.5px, line: 18px, weight: 400 }
  spacing:
    1: 4px
    2: 8px
    3: 12px
    4: 16px
    6: 24px
    8: 32px
  radius:
    sm: 3px
    md: 5px
    lg: 8px
  shadow:
    pop: { light: "0 6px 20px rgba(28,29,26,0.14), 0 1px 2px rgba(28,29,26,0.10)", dark: "0 8px 24px rgba(0,0,0,0.5)" }
  motion:
    duration-fast: 120ms
    duration-base: 180ms
    duration-slow: 280ms
    ease-out: "cubic-bezier(0.22, 1, 0.36, 1)"
    ease-inout: "cubic-bezier(0.65, 0, 0.35, 1)"
---

# Kages Core

## Overview

Neutral lattice system. The base every other system extends.

**Signature move.** Neutral lattice: structure from spacing steps and declared props, never from decoration.

## Colour

| Role | light | dark | Use |
| --- | --- | --- | --- |
| `paper` | `#f4f2ec` | `#141513` | Page ground behind every block. |
| `surface` | `#fffdf8` | `#1c1e1b` | Raised blocks: cards, inputs, menus, tables. |
| `sunken` | `#ebe7de` | `#232521` | Recessed regions: sidebar, table header, tinted cards. |
| `line` | `#dcd6ca` | `#343730` | Hairline dividers and card borders (decorative, not a control edge). |
| `line-control` | `#857e6f` | `#7f8377` | Edges of interactive controls (3:1 on surface). |
| `ink` | `#1c1d1a` | `#edebe4` | Primary text and icons on paper/surface/sunken. |
| `ink-muted` | `#595b53` | `#a6a89e` | Secondary text, labels, captions (4.5:1 on paper/surface). |
| `accent` | `#9c4a17` | `#e6904f` | Primary actions and the active nav item marker. The identity colour. |
| `accent-ink` | `#fffdf8` | `#1c1208` | Text on an accent fill. |
| `accent-soft` | `#f3e2d2` | `#3b2818` | Selected-row and active-item tint; ink text sits on it. |
| `wire` | `#1f6a70` | `#6cc0c4` | References and links between blocks: focus rings, ref highlights, links. |
| `wire-soft` | `#d9ecec` | `#173537` | Tint behind wire-coloured badges. |
| `success` | `#2f6b45` | `#7cc493` | Positive deltas and success text. |
| `danger` | `#b0281f` | `#f0857b` | Destructive buttons, negative deltas, errors. |
| `danger-soft` | `#f8dcd8` | `#3f1d1a` | Error banners and danger badges; ink text sits on it. |
| `focus` | `#1f6a70` | `#6cc0c4` | Focus ring on every interactive control. |

Declared contrast pairs (WCAG 2.x):

| Text | On | Purpose | Need | light | dark |
| --- | --- | --- | --- | --- | --- |
| `ink` | `paper` | body text on the page | 4.5:1 | 15.13:1 pass | 15.36:1 pass |
| `ink` | `surface` | body text on cards, inputs, menus | 4.5:1 | 16.66:1 pass | 14.07:1 pass |
| `ink` | `sunken` | body text on recessed regions | 4.5:1 | 13.72:1 pass | 12.96:1 pass |
| `ink-muted` | `paper` | secondary text on the page | 4.5:1 | 6.16:1 pass | 7.60:1 pass |
| `ink-muted` | `surface` | secondary text on cards | 4.5:1 | 6.78:1 pass | 6.97:1 pass |
| `ink-muted` | `sunken` | secondary text on recessed regions | 4.5:1 | 5.59:1 pass | 6.42:1 pass |
| `accent-ink` | `accent` | label on a filled accent button | 4.5:1 | 6.07:1 pass | 7.43:1 pass |
| `accent` | `paper` | links and accent text on the page | 4.5:1 | 5.51:1 pass | 7.39:1 pass |
| `accent` | `surface` | links and accent text on cards | 4.5:1 | 6.07:1 pass | 6.77:1 pass |
| `accent` | `sunken` | code keywords on recessed code blocks | 4.5:1 | 5.00:1 pass | 6.23:1 pass |
| `success` | `sunken` | code strings on recessed code blocks | 4.5:1 | 5.14:1 pass | 7.49:1 pass |
| `ink` | `accent-soft` | text on soft accent fills | 4.5:1 | 13.40:1 pass | 11.72:1 pass |
| `danger` | `surface` | error text | 4.5:1 | 6.52:1 pass | 6.67:1 pass |
| `ink` | `danger-soft` | text on soft danger fills | 4.5:1 | 13.08:1 pass | 12.56:1 pass |
| `success` | `surface` | success text | 4.5:1 | 6.24:1 pass | 8.13:1 pass |
| `line-control` | `paper` | input and control borders on the page | 3:1 | 3.60:1 pass | 4.72:1 pass |
| `line-control` | `surface` | input and control borders on cards | 3:1 | 3.96:1 pass | 4.33:1 pass |
| `focus` | `paper` | keyboard focus ring on the page | 3:1 | 5.59:1 pass | 8.70:1 pass |
| `focus` | `surface` | keyboard focus ring on cards | 3:1 | 6.16:1 pass | 7.97:1 pass |
| `wire` | `paper` | diagram and wire strokes | 3:1 | 5.59:1 pass | 8.70:1 pass |
| `ink` | `wire-soft` | text on soft wire fills | 4.5:1 | 13.84:1 pass | 11.00:1 pass |

## Typography

| Style | Size / line | Weight | Face | Use |
| --- | --- | --- | --- | --- |
| `core-display` | 40px / 44px | 700 | display | Artifact title on a cover or empty state. |
| `core-title` | 22px / 28px | 650 | display | text variant=title; one per region. |
| `core-heading` | 16px / 22px | 600 | sans | Card titles, text variant=heading. |
| `core-body` | 14px / 20px | 400 | sans | Default block text, inputs, table cells. |
| `core-label` | 12px / 16px | 500 | sans | Field labels, stat labels, nav badges. |
| `core-code` | 12.5px / 18px | 400 | mono | Block ids, refs ($block, $state), contract snippets. |

## Layout and spacing

| Step | Value | Use |
| --- | --- | --- |
| `space-1` | 4px | Icon-to-label gap; stack gap=1. |
| `space-2` | 8px | Control inner gaps; stack gap=2. |
| `space-3` | 12px | Control padding; stack gap=3. |
| `space-4` | 16px | Card padding (Core); default stack gap. |
| `space-6` | 24px | Between sections of a view; Atelier card padding. |
| `space-8` | 32px | Shell main padding; stack gap=8. |

## Elevation and shape

| Radius | Value | Use |
| --- | --- | --- |
| `sm` | 3px | badges, nav monograms. |
| `md` | 5px | buttons, inputs, dropdown menu. |
| `lg` | 8px | cards, shell panels. |

Shadow `shadow-pop`: dropdown menus and popovers only. Light `0 6px 20px rgba(28,29,26,0.14), 0 1px 2px rgba(28,29,26,0.10)`.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `motion-duration-fast` | 120ms | Small state changes: a chevron turning, a thumb sliding. |
| `motion-duration-base` | 180ms | Panels and navigation opening or collapsing. |
| `motion-duration-slow` | 280ms | Larger reveals; use sparingly. |
| `motion-ease-out` | cubic-bezier(0.22, 1, 0.36, 1) | Default: starts quickly and settles, from an already-visible state. |
| `motion-ease-inout` | cubic-bezier(0.65, 0, 0.35, 1) | Movement between two resting positions. |

## Components

82 roles: shell → core/shell@1.0.0, sidebar → core/sidebar@1.2.0, dropdown → core/dropdown@1.3.0, tabs → core/tabs@1.0.0, button → core/button@1.1.0, text-input → core/text-input@1.0.0, card → core/card@1.0.0, stack → core/stack@1.0.0, text → core/text@1.0.0, badge → core/badge@1.0.0, stat → core/stat@1.0.0, table → core/table@1.0.0, page → core/page@1.0.0, section → core/section@1.1.0, grid → core/grid@1.0.0, split → core/split@1.0.0, image → core/image@1.0.0, code → core/code@1.1.0, list → core/list@1.0.0, divider → core/divider@1.0.0, textarea → core/textarea@1.0.0, slider → core/slider@1.0.0, checkbox → core/checkbox@1.0.0, bar-chart → core/bar-chart@1.1.0, composition → core/composition@1.0.0, link → core/link@1.0.0, rich-text → core/rich-text@1.1.0, text-field → core/text-field@1.1.0, number-input → core/number-input@1.1.0, date-input → core/date-input@1.1.0, choice → core/choice@1.1.0, multiselect → core/multiselect@1.1.0, form → core/form@1.0.0, scene → core/scene@1.1.0, diagram → core/diagram@1.4.0, line-chart → core/line-chart@1.2.0, scatter-chart → core/scatter-chart@1.2.0, area-chart → core/area-chart@1.2.0, donut-chart → core/donut-chart@1.2.0, gauge → core/gauge@1.1.0, sparkline → core/sparkline@1.1.0, heatmap → core/heatmap@1.2.0, alert → core/alert@1.0.0, accordion → core/accordion@1.0.0, stepper → core/stepper@1.0.0, timeline → core/timeline@1.0.0, modal → core/modal@1.0.0, switch → core/switch@1.0.0, combobox → core/combobox@1.0.0, tree → core/tree@1.0.0, data-grid → core/data-grid@1.0.0, kanban → core/kanban@1.0.0, calendar → core/calendar@1.0.0, carousel → core/carousel@1.0.0, markdown → core/markdown@1.0.0, math → core/math@1.0.0, combo-chart → core/combo-chart@1.1.0, stacked-bar-chart → core/stacked-bar-chart@1.1.0, funnel-chart → core/funnel-chart@1.1.0, treemap → core/treemap@1.1.0, sankey → core/sankey@1.1.0, map → core/map@1.1.0, tab-panel → core/tab-panel@1.0.0, code-tabs → core/code-tabs@1.0.0, anchor → core/anchor@1.0.0, toc → core/toc@1.0.0, video → core/video@1.0.0, audio → core/audio@1.0.0, glossary → core/glossary@1.0.0, references → core/references@1.0.0, gallery → core/gallery@1.0.0, date-range → core/date-range@1.0.0, file-upload → core/file-upload@1.0.0, guide → core/guide@1.0.0, disclosure → core/disclosure@1.0.0, canvas → core/canvas@1.0.0, histogram-chart → core/histogram-chart@1.0.0, box-plot → core/box-plot@1.0.0, waterfall-chart → core/waterfall-chart@1.0.0, small-multiples → core/small-multiples@1.0.0, csv-import → core/csv-import@1.0.0, source-status → core/source-status@1.0.0.

## Named rules

- **One Primary Per Region** — Give each region one primary button and label every button with a verb. Two primaries ask the reader to guess which action matters; a noun label hides what pressing does.
- **Cards Earn Their Keep** — A card groups one topic. Never nest cards, and never wrap every section in one. Containers inside containers add depth and noise; spacing and headings already group content. (lint: nested-sections)
- **Steps, Not Pixels** — Set layout with declared props and token spacing steps; never write pixel values. Tokens keep every system and theme coherent; pixel values pin one rendering.
- **Bind, Don't Copy** — Feed numbers and text from data and state with expressions instead of retyping them. A retyped figure drifts from its source and cannot respond to filters.
- **Navigation Fits The Shape** — Use a sidebar for 3–9 persistent sections and tabs for 2–6 sibling views; omit both when the page reads straight through. Navigation is optional; extra chrome on a short page costs more than it helps.
- **Wire Every Control** — Every button, form and modal needs a handler or a command that reaches it. A control that does nothing teaches readers the page is broken. (lint: dead-button, form-unwired, modal-unreachable)
- **Describe The Picture** — Give every image alt text and every chart a label that states what it shows. Assistive technology and screenshots depend on the label; a bare chart says nothing to them.

## Do and don't

Do: follow the named rules above.

Don't:
- Using a button to show state (core/button)
- Cards inside cards (core/card)
- Pixel values; gap is a spacing step (core/stack)
- More than 6 in a row (core/stat)
- Long documents; that is a Docs artifact (core/text)
- More than 9 items; put nested content in tabs instead (core/sidebar)
- Top-level navigation (that is the sidebar's job) (core/tabs)
- Nesting shells (core/shell)

## Known issues

None: contrast pairs pass; colour tokens document usage.
