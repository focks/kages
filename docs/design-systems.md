# Design systems

Each system is described by one generated document, its **system card**: tokens for light and dark, computed contrast, type, spacing, shape, components, named rules and known issues.

```sh
kages system card ledger
kages system contrast ledger
```

## Core

The neutral base every other system extends. Its named rules are the ones that apply everywhere: one primary action per region, cards earn their keep, steps not pixels, bind rather than copy, wire every control, describe the picture.

## Ledger

Dense, square, mono. Panels are addressable by short codes, tab labels are short and uppercase, trends carry real data, and navigation is grouped. Use it for tools and consoles.

## Atelier

Soft and editorial. One story at a time, set in serif with room to breathe: short navigation, at most four tabs, friendly choices, captions written as sentences. Use it for reading, reports and storytelling.

## Contrast is checked

Every system declares pairs of colours that must stay readable, such as body text on the page and focus rings on cards, in both light and dark. The design-system build fails if a pair drops below its minimum, unless it is waived with a written reason.

## Browser surfaces and motion

Text selection, the caret, native controls and scrollbars inside a Kage follow the system's palette. When a reader asks for reduced motion, nothing in a Kage animates, including the frozen reference styles.

## Choosing

Pick the system for the reader, not for taste: Ledger when they operate, Atelier when they read. If a page needs a block the system does not offer, name the missing capability instead of working around it. The same blocks exist in all three systems — see [blocks](blocks.md) for the catalog and how to read any contract.
