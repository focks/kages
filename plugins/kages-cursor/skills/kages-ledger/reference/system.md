---
system: ledger
version: 2.14.0
extends: core@1
tokens:
  colors:
    paper: { light: "#f6f7f5", dark: "#0d0f0e" }
    surface: { light: "#ffffff", dark: "#141715" }
    sunken: { light: "#eceeea", dark: "#1a1e1b" }
    line: { light: "#d5d9d2", dark: "#2a2f2b" }
    line-control: { light: "#7a8176", dark: "#6f776f" }
    ink: { light: "#0f1210", dark: "#e7ebe6" }
    ink-muted: { light: "#4f564e", dark: "#9aa39a" }
    accent: { light: "#1d3b2a", dark: "#9fd3ae" }
    accent-ink: { light: "#f6f7f5", dark: "#0d1a12" }
    accent-soft: { light: "#dfe9e2", dark: "#1c3326" }
    wire: { light: "#7a4f00", dark: "#f0b54a" }
    wire-soft: { light: "#f6e8c8", dark: "#3a2c10" }
    success: { light: "#1f6b3a", dark: "#8fd6a6" }
    danger: { light: "#b3261e", dark: "#ff8a80" }
    danger-soft: { light: "#f9dedb", dark: "#3d1a17" }
    focus: { light: "#7a4f00", dark: "#f0b54a" }
  type:
    title: { family: sans, size: 18px, line: 24px, weight: 600 }
    body: { family: sans, size: 13px, line: 18px, weight: 400 }
    label: { family: mono, size: 11px, line: 14px, weight: 500, tracking: 0.06em }
    figure: { family: mono, size: 26px, line: 30px, weight: 500 }
  radius:
    sm: 0px
    md: 2px
  motion:
    duration-fast: 120ms
    duration-base: 180ms
    duration-slow: 280ms
    ease-out: "cubic-bezier(0.22, 1, 0.36, 1)"
    ease-inout: "cubic-bezier(0.65, 0, 0.35, 1)"
components:
  sidebar: ledger/sidebar@2.0.0
  dropdown: ledger/dropdown@2.0.0
  tabs: ledger/tabs@2.0.0
  button: ledger/button@2.1.0
  card: ledger/card@2.0.0
  stat: ledger/stat@2.0.0
---

# Ledger

## Overview

Dense, square, mono-numeral system for data and operations tools.

**Signature move.** Dense, square and mono: every panel is an addressable ticker.

Extends core@1; roles not listed under Components are inherited.

## Colour

| Role | light | dark | Use |
| --- | --- | --- | --- |
| `paper` | `#f6f7f5` | `#0d0f0e` | Page ground behind every block. |
| `surface` | `#ffffff` | `#141715` | Raised blocks: cards, inputs, menus, tables. |
| `sunken` | `#eceeea` | `#1a1e1b` | Recessed regions: sidebar, table header, tinted cards. |
| `line` | `#d5d9d2` | `#2a2f2b` | Hairline dividers and card borders (decorative, not a control edge). |
| `line-control` | `#7a8176` | `#6f776f` | Edges of interactive controls (3:1 on surface). |
| `ink` | `#0f1210` | `#e7ebe6` | Primary text and icons on paper/surface/sunken. |
| `ink-muted` | `#4f564e` | `#9aa39a` | Secondary text, labels, captions (4.5:1 on paper/surface). |
| `accent` | `#1d3b2a` | `#9fd3ae` | Primary actions and the active nav item marker. The identity colour. |
| `accent-ink` | `#f6f7f5` | `#0d1a12` | Text on an accent fill. |
| `accent-soft` | `#dfe9e2` | `#1c3326` | Selected-row and active-item tint; ink text sits on it. |
| `wire` | `#7a4f00` | `#f0b54a` | References and links between blocks: focus rings, ref highlights, links. |
| `wire-soft` | `#f6e8c8` | `#3a2c10` | Tint behind wire-coloured badges. |
| `success` | `#1f6b3a` | `#8fd6a6` | Positive deltas and success text. |
| `danger` | `#b3261e` | `#ff8a80` | Destructive buttons, negative deltas, errors. |
| `danger-soft` | `#f9dedb` | `#3d1a17` | Error banners and danger badges; ink text sits on it. |
| `focus` | `#7a4f00` | `#f0b54a` | Focus ring on every interactive control. |

Declared contrast pairs (WCAG 2.x):

| Text | On | Purpose | Need | light | dark |
| --- | --- | --- | --- | --- | --- |
| `ink` | `paper` | body text on the page | 4.5:1 | 17.54:1 pass | 15.96:1 pass |
| `ink` | `surface` | body text on cards, inputs, menus | 4.5:1 | 18.85:1 pass | 14.98:1 pass |
| `ink` | `sunken` | body text on recessed regions | 4.5:1 | 16.14:1 pass | 13.99:1 pass |
| `ink-muted` | `paper` | secondary text on the page | 4.5:1 | 7.05:1 pass | 7.40:1 pass |
| `ink-muted` | `surface` | secondary text on cards | 4.5:1 | 7.57:1 pass | 6.95:1 pass |
| `ink-muted` | `sunken` | secondary text on recessed regions | 4.5:1 | 6.48:1 pass | 6.49:1 pass |
| `accent-ink` | `accent` | label on a filled accent button | 4.5:1 | 11.42:1 pass | 10.57:1 pass |
| `accent` | `paper` | links and accent text on the page | 4.5:1 | 11.42:1 pass | 11.36:1 pass |
| `accent` | `surface` | links and accent text on cards | 4.5:1 | 12.27:1 pass | 10.66:1 pass |
| `accent` | `sunken` | code keywords on recessed code blocks | 4.5:1 | 10.51:1 pass | 9.96:1 pass |
| `success` | `sunken` | code strings on recessed code blocks | 4.5:1 | 5.58:1 pass | 9.91:1 pass |
| `ink` | `accent-soft` | text on soft accent fills | 4.5:1 | 15.16:1 pass | 11.23:1 pass |
| `danger` | `surface` | error text | 4.5:1 | 6.54:1 pass | 7.91:1 pass |
| `ink` | `danger-soft` | text on soft danger fills | 4.5:1 | 14.81:1 pass | 12.83:1 pass |
| `success` | `surface` | success text | 4.5:1 | 6.52:1 pass | 10.61:1 pass |
| `line-control` | `paper` | input and control borders on the page | 3:1 | 3.74:1 pass | 4.16:1 pass |
| `line-control` | `surface` | input and control borders on cards | 3:1 | 4.02:1 pass | 3.91:1 pass |
| `focus` | `paper` | keyboard focus ring on the page | 3:1 | 6.63:1 pass | 10.45:1 pass |
| `focus` | `surface` | keyboard focus ring on cards | 3:1 | 7.13:1 pass | 9.81:1 pass |
| `wire` | `paper` | diagram and wire strokes | 3:1 | 6.63:1 pass | 10.45:1 pass |
| `ink` | `wire-soft` | text on soft wire fills | 4.5:1 | 15.52:1 pass | 11.26:1 pass |

## Typography

| Style | Size / line | Weight | Face | Use |
| --- | --- | --- | --- | --- |
| `title` | 18px / 24px | 600 | sans | Region titles. Ledger avoids display sizes. |
| `body` | 13px / 18px | 400 | sans | Dense body and table cells. |
| `label` | 11px / 14px | 500 | mono | Uppercase labels, tab names, card bars, buttons. |
| `figure` | 26px / 30px | 500 | mono | Stat values; tabular numerals. |

## Layout and spacing

Uses Core's spacing steps (0, 1, 2, 3, 4, 6, 8).

## Elevation and shape

| Radius | Value | Use |
| --- | --- | --- |
| `sm` | 0px | everything is square. |
| `md` | 2px | segmented control outer edge only. |

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

- `sidebar` → `ledger/sidebar@2.0.0`
- `dropdown` → `ledger/dropdown@2.0.0`
- `tabs` → `ledger/tabs@2.0.0`
- `button` → `ledger/button@2.1.0`
- `card` → `ledger/card@2.0.0`
- `stat` → `ledger/stat@2.0.0`

Inherited from Core (76): shell, text-input, stack, text, badge, table, page, section, grid, split, image, code, list, divider, textarea, slider, checkbox, bar-chart, composition, link, rich-text, text-field, number-input, date-input, choice, multiselect, form, scene, diagram, line-chart, scatter-chart, area-chart, donut-chart, gauge, sparkline, heatmap, alert, accordion, stepper, timeline, modal, switch, combobox, tree, data-grid, kanban, calendar, carousel, markdown, math, combo-chart, stacked-bar-chart, funnel-chart, treemap, sankey, map, tab-panel, code-tabs, anchor, toc, video, audio, glossary, references, gallery, date-range, file-upload, guide, disclosure, canvas, histogram-chart, box-plot, waterfall-chart, small-multiples, csv-import, source-status.

## Named rules

- **Short Uppercase Labels** — Keep tab labels under 15 characters and write button labels that still read in uppercase. Ledger uppercases labels in a narrow mono face; long sentence-case text truncates or shouts.
- **Segmented Choices Stay Short** — Use the dropdown for up to six short options; pin core/dropdown@1 for long or dynamic lists. Ledger shows every option at once as a segmented control, so a long list overflows the row.
- **Panels Sit Flush** — Fill a card edge to edge and give it a short panel code such as PNL-01. Dense grids depend on bodies sitting flush; padding-heavy content breaks the rhythm.
- **Trends Carry Data** — Add a stat trend only with 8–30 real numbers behind it. A sparkline with no data is decoration, and in a dense tool it reads as a measurement.
- **Group The Navigation** — Group sidebar items under headers, keep labels to one line and use 2–4 character codes. Ledger truncates at one line; groups and tickers keep a long list scannable.

## Do and don't

Do: follow the named rules above.

Don't:
- Tab labels over 14 characters (ledger/tabs)
- Sentence-case labels; Ledger uppercases (ledger/button)
- Long or dynamic option lists — pin `core/dropdown@1` for those (ledger/dropdown)
- Padding-heavy content; bodies sit flush (ledger/card)
- Decorative trends with no data (ledger/stat)
- Long labels; Ledger truncates at one line (ledger/sidebar)

## Known issues

None: contrast pairs pass; colour tokens document usage.
