# harden

Empty, long and failing data; forms that explain their errors.

## Purpose
Make the page survive real data and real failures.

## Before you start
Call `get_context` with the Kage. Note which blocks bind to data or state.

## Scope
Empty collections, one very long value, many items, missing images, slow or failed loads, narrow screens, and right-to-left text where the audience needs it. Not new features.

## Steps
1. Read `describe_kage` and find every block that shows data (tables, charts, lists, stats, forms).
2. For each, decide what the reader sees when it is empty, long, and wrong. Add an empty state or a message where there is none.
3. Make forms validate where the reader types (`error` bound to a rule) and say what to do.
4. Patch with `patch_kage` after `validate_patch`. Render with `kages screenshot <name> --width 390,1200`.

## Verification
Look once, in one batched round: render a phone width and a desktop width together, collect everything that shows, fix it all in one patch, check once more at most, and stop. Try the longest realistic label in the narrowest layout.

## Done when
Every data block has a defined empty state, every form error names the problem and the fix, and the narrow render has no sideways scroll.

## Hand off to
adapt for layout; onboard for first-run.
