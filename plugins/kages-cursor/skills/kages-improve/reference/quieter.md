# quieter

One controlled step down in intensity.

## Purpose
Turn the intensity down one step without changing what the page says.

## Before you start
Call `get_context` with the Kage. A persuade page may keep its hero; an operate page should rarely need this.

## Scope
Only the declared knobs: section tone, spacing, display headings, extra primary buttons, grid column width.

## Steps
1. Run `kages tune <name> --quieter` (the `tune_kage` op) for the dry run and read the knob table.
2. If it is what you meant, apply it with `--apply` (or `tune_kage` with apply true). Use `--scope <block>` to limit it to one region.
3. If the page is still loud, repeat once, or distill. If you overshot, bolder steps it back.

## Verification
Look once, in one batched round: render a phone width and a desktop width together, collect everything that shows, fix it all in one patch, check once more at most, and stop.

## Done when
One primary action per region, one display heading, and no section louder than it needs to be.

## Hand off to
polish; distill; bolder if you overshot.
