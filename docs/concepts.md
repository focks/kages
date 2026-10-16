# Concepts

Five ideas explain almost everything in Kages.

## Blocks

A Kage is a tree of blocks: a page holds sections, a section holds text, a chart, a form. Every block has a type (its role), props that its contract declares, and optional bindings and event handlers. Agents choose blocks and props; the renderer draws them. Nothing in a Kage is HTML or executable code.

## Design systems

A design system decides how the same blocks look and behave. Kages ships three:

- **Core**, a neutral base.
- **Ledger**, dense, square and mono-numeral, for data and operations tools.
- **Atelier**, soft, editorial and serif, for reading and storytelling.

A Kage keeps the system it was created in. Ledger and Atelier extend Core, so a block they do not override behaves as in Core.

## Contracts

A contract is the published promise of one block: its props, events, outputs, commands and limits. Validation checks a document against contracts, and each version records exactly which contract refs it was built with, so an old Kage never changes under you.

## Versions

Every write makes a new immutable, signed version with its author and a summary of the change. Edit with patches (small JSON Patch operations) rather than regenerating a Kage, so history stays readable and two people can edit different blocks at once.

## Mode and brief

Two small records tell everyone what the work is for:

- The **workspace brief** holds durable product truth: who it is for, what it is for, what must never be invented.
- A Kage's **mode** says what its visitor is trying to do. Modes decide which checks apply: a marketing page is checked for unsourced claims, an operations console is not.

Both are data that agents read, never instructions they obey.

## Where to go next

[Authoring with agents](authoring-with-agents.md) puts these together, and [design systems](design-systems.md) goes deeper on the three systems.
