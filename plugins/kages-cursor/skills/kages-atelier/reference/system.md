---
system: atelier
version: 1.14.0
extends: core@1
tokens:
  colors:
    paper: { light: "#faf6f1", dark: "#1a1614" }
    surface: { light: "#fffaf5", dark: "#221d1a" }
    sunken: { light: "#f1e9df", dark: "#2a2420" }
    line: { light: "#e6dccf", dark: "#3a322c" }
    line-control: { light: "#968877", dark: "#8c7f72" }
    ink: { light: "#2a2420", dark: "#f3ebe2" }
    ink-muted: { light: "#665b53", dark: "#b3a699" }
    accent: { light: "#7a2e3b", dark: "#e8a0aa" }
    accent-ink: { light: "#fffaf5", dark: "#2a1216" }
    accent-soft: { light: "#f4dfe1", dark: "#43242a" }
    wire: { light: "#4b6b2f", dark: "#b5cf8e" }
    wire-soft: { light: "#e4ecd6", dark: "#2c3520" }
    success: { light: "#3f6b2f", dark: "#a9cf8e" }
    danger: { light: "#a8321f", dark: "#f19a86" }
    danger-soft: { light: "#f8e0d9", dark: "#42221b" }
    focus: { light: "#7a2e3b", dark: "#e8a0aa" }
  type:
    display: { family: serif, size: 44px, line: 48px, weight: 500 }
    title: { family: serif, size: 24px, line: 30px, weight: 500 }
    body: { family: soft, size: 15px, line: 24px, weight: 400 }
    eyebrow: { family: soft, size: 12px, line: 16px, weight: 600, tracking: 0.08em }
  radius:
    md: 14px
    lg: 22px
    pill: 999px
  shadow:
    soft: { light: "0 10px 30px rgba(42,36,32,0.08)", dark: "0 10px 30px rgba(0,0,0,0.35)" }
  motion:
    duration-fast: 120ms
    duration-base: 180ms
    duration-slow: 280ms
    ease-out: "cubic-bezier(0.22, 1, 0.36, 1)"
    ease-inout: "cubic-bezier(0.65, 0, 0.35, 1)"
components:
  sidebar: atelier/sidebar@1.0.0
  dropdown: atelier/dropdown@1.0.0
  tabs: atelier/tabs@1.0.0
  button: atelier/button@1.0.0
  card: atelier/card@1.0.0
  stat: atelier/stat@1.0.0
---

# Atelier

## Overview

Soft, editorial, serif system for consumer and storytelling artifacts.

**Signature move.** Soft and editorial: one story at a time, set in serif with room to breathe.

Extends core@1; roles not listed under Components are inherited.

## Colour

| Role | light | dark | Use |
| --- | --- | --- | --- |
| `paper` | `#faf6f1` | `#1a1614` | Page ground behind every block. |
| `surface` | `#fffaf5` | `#221d1a` | Raised blocks: cards, inputs, menus, tables. |
| `sunken` | `#f1e9df` | `#2a2420` | Recessed regions: sidebar, table header, tinted cards. |
| `line` | `#e6dccf` | `#3a322c` | Hairline dividers and card borders (decorative, not a control edge). |
| `line-control` | `#968877` | `#8c7f72` | Edges of interactive controls (3:1 on surface). |
| `ink` | `#2a2420` | `#f3ebe2` | Primary text and icons on paper/surface/sunken. |
| `ink-muted` | `#665b53` | `#b3a699` | Secondary text, labels, captions (4.5:1 on paper/surface). |
| `accent` | `#7a2e3b` | `#e8a0aa` | Primary actions and the active nav item marker. The identity colour. |
| `accent-ink` | `#fffaf5` | `#2a1216` | Text on an accent fill. |
| `accent-soft` | `#f4dfe1` | `#43242a` | Selected-row and active-item tint; ink text sits on it. |
| `wire` | `#4b6b2f` | `#b5cf8e` | References and links between blocks: focus rings, ref highlights, links. |
| `wire-soft` | `#e4ecd6` | `#2c3520` | Tint behind wire-coloured badges. |
| `success` | `#3f6b2f` | `#a9cf8e` | Positive deltas and success text. |
| `danger` | `#a8321f` | `#f19a86` | Destructive buttons, negative deltas, errors. |
| `danger-soft` | `#f8e0d9` | `#42221b` | Error banners and danger badges; ink text sits on it. |
| `focus` | `#7a2e3b` | `#e8a0aa` | Focus ring on every interactive control. |

Declared contrast pairs (WCAG 2.x):

| Text | On | Purpose | Need | light | dark |
| --- | --- | --- | --- | --- | --- |
| `ink` | `paper` | body text on the page | 4.5:1 | 14.23:1 pass | 15.22:1 pass |
| `ink` | `surface` | body text on cards, inputs, menus | 4.5:1 | 14.76:1 pass | 14.14:1 pass |
| `ink` | `sunken` | body text on recessed regions | 4.5:1 | 12.73:1 pass | 12.97:1 pass |
| `ink-muted` | `paper` | secondary text on the page | 4.5:1 | 6.13:1 pass | 7.56:1 pass |
| `ink-muted` | `surface` | secondary text on cards | 4.5:1 | 6.35:1 pass | 7.02:1 pass |
| `ink-muted` | `sunken` | secondary text on recessed regions | 4.5:1 | 5.48:1 pass | 6.44:1 pass |
| `accent-ink` | `accent` | label on a filled accent button | 4.5:1 | 8.87:1 pass | 8.39:1 pass |
| `accent` | `paper` | links and accent text on the page | 4.5:1 | 8.55:1 pass | 8.59:1 pass |
| `accent` | `surface` | links and accent text on cards | 4.5:1 | 8.87:1 pass | 7.98:1 pass |
| `accent` | `sunken` | code keywords on recessed code blocks | 4.5:1 | 7.65:1 pass | 7.32:1 pass |
| `success` | `sunken` | code strings on recessed code blocks | 4.5:1 | 5.20:1 pass | 8.75:1 pass |
| `ink` | `accent-soft` | text on soft accent fills | 4.5:1 | 12.02:1 pass | 11.67:1 pass |
| `danger` | `surface` | error text | 4.5:1 | 6.45:1 pass | 7.71:1 pass |
| `ink` | `danger-soft` | text on soft danger fills | 4.5:1 | 12.14:1 pass | 12.05:1 pass |
| `success` | `surface` | success text | 4.5:1 | 6.03:1 pass | 9.54:1 pass |
| `line-control` | `paper` | input and control borders on the page | 3:1 | 3.21:1 pass | 4.61:1 pass |
| `line-control` | `surface` | input and control borders on cards | 3:1 | 3.33:1 pass | 4.29:1 pass |
| `focus` | `paper` | keyboard focus ring on the page | 3:1 | 8.55:1 pass | 8.59:1 pass |
| `focus` | `surface` | keyboard focus ring on cards | 3:1 | 8.87:1 pass | 7.98:1 pass |
| `wire` | `paper` | diagram and wire strokes | 3:1 | 5.67:1 pass | 10.51:1 pass |
| `ink` | `wire-soft` | text on soft wire fills | 4.5:1 | 12.59:1 pass | 10.87:1 pass |

## Typography

| Style | Size / line | Weight | Face | Use |
| --- | --- | --- | --- | --- |
| `display` | 44px / 48px | 500 | serif | Hero titles and stat figures. |
| `title` | 24px / 30px | 500 | serif | Card titles. |
| `body` | 15px / 24px | 400 | soft | Prose and default text. |
| `eyebrow` | 12px / 16px | 600 | soft | Kicker above a card title, uppercase. |

## Layout and spacing

Uses Core's spacing steps (0, 1, 2, 3, 4, 6, 8).

## Elevation and shape

| Radius | Value | Use |
| --- | --- | --- |
| `md` | 14px | inputs, nav items. |
| `lg` | 22px | cards and sidebar panel. |
| `pill` | 999px | buttons, chips, tabs. |

Shadow `shadow-soft`: cards float softly; Ledger uses no shadows. Light `0 10px 30px rgba(42,36,32,0.08)`.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `motion-duration-fast` | 120ms | Small state changes: a chevron turning, a thumb sliding. |
| `motion-duration-base` | 180ms | Panels and navigation opening or collapsing. |
| `motion-duration-slow` | 280ms | Larger reveals; use sparingly. |
| `motion-ease-out` | cubic-bezier(0.22, 1, 0.36, 1) | Default: starts quickly and settles, from an already-visible state. |
| `motion-ease-inout` | cubic-bezier(0.65, 0, 0.35, 1) | Movement between two resting positions. |

## Components

Structural overrides:

- `sidebar` → `atelier/sidebar@1.0.0`
- `dropdown` → `atelier/dropdown@1.0.0`
- `tabs` → `atelier/tabs@1.0.0`
- `button` → `atelier/button@1.0.0`
- `card` → `atelier/card@1.0.0`
- `stat` → `atelier/stat@1.0.0`

Inherited from Core (76): shell, text-input, stack, text, badge, table, page, section, grid, split, image, code, list, divider, textarea, slider, checkbox, bar-chart, composition, link, rich-text, text-field, number-input, date-input, choice, multiselect, form, scene, diagram, line-chart, scatter-chart, area-chart, donut-chart, gauge, sparkline, heatmap, alert, accordion, stepper, timeline, modal, switch, combobox, tree, data-grid, kanban, calendar, carousel, markdown, math, combo-chart, stacked-bar-chart, funnel-chart, treemap, sankey, map, tab-panel, code-tabs, anchor, toc, video, audio, glossary, references, gallery, date-range, file-upload, guide, disclosure, canvas, histogram-chart, box-plot, waterfall-chart, small-multiples, csv-import, source-status.

## Named rules

- **Short Navigation** — Keep the sidebar to six items, each with a one-line description; leave dense tool navigation to Ledger. Atelier is for reading and storytelling; a long menu turns a story into a tool.
- **Four Tabs At Most** — Switch between two to four views with pill tabs and never add a fifth. The pill switcher is built for a few friendly choices; more belongs in a page of sections.
- **Friendly Choices** — Offer two to ten options of up to three words each. Options render as wrapping chips, and long labels turn them into a wall of text.
- **One Primary Per Card** — Put at most one primary pill button in a card; the rest are secondary or quiet. The ink-filled primary is the page's one loud gesture.
- **Captions In Sentences** — Show up to three stats per row, each with a caption written as a sentence. A big serif figure needs a sentence of context; a fourth stat crowds the row.
- **Tables Leave The Card** — Keep tables out of cards when the page must work on a narrow screen. Atelier cards are padded and soft, so a table inside one overflows on phones.

## Do and don't

Do: follow the named rules above.

Don't:
- Dense tool navigation — that is Ledger's job (atelier/sidebar)
- More than 4 tabs (atelier/tabs)
- Options over 3 words (atelier/dropdown)
- More than one primary per card (atelier/button)
- More than 3 per row (atelier/stat)
- Tables inside Atelier cards on narrow screens (atelier/card)

## Known issues

None: contrast pairs pass; colour tokens document usage.
