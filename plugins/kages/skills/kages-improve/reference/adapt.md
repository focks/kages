# adapt

Phone, tablet, desktop and dark theme.

## Purpose
Make the page work at phone, tablet and desktop widths and in dark theme.

## Before you start
Call `get_context` with the Kage.

## Scope
Layout, density and overflow. Not content.

## Steps
1. Render with `kages screenshot <name> --width 390,768,1200` and again with `--dark`. Note every finding it reports: sideways scroll, broken images, tiny text, failed blocks.
2. Fix at the source: choose a grid `minSize`, a split `ratio` that stacks, shorter labels, a smaller figure, a table that scrolls or becomes a list. Do not add special cases for one width.
3. Patch with `patch_kage` after `validate_patch`.

## Verification
Look once, in one batched round: render a phone width and a desktop width together, collect everything that shows, fix it all in one patch, check once more at most, and stop.

## Done when
The screenshot checks report no findings at 390, 768 and 1200, light and dark.

## Hand off to
harden; polish.
