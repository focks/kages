---
description: Clear the open P0/P1 backlog, then make the page consistent
argument-hint: <kage>
---

Apply the Kages improve move "polish" to $ARGUMENTS. Call get_improve_packet {command:"polish", kage:<the Kage name>} for the playbook and its context, then follow the playbook.

## Purpose
Clear the open P0 and P1 items of the latest critique, then make the page consistent.

## Before you start
Call `get_context` with the Kage. If CRITIQUE_STALE is raised, the critique is old: run critique first. If there is no critique, run critique first.

## Scope
Only what the backlog and the lint findings name, plus obvious inconsistencies in spacing, wording and variants. No redesign, no new content.

## Steps
1. Read the backlog with `list_critiques` and the findings with `lint_kage`.
2. Draft one patch for the open P0 and P1 items, then the lint findings. Try it with `validate_patch` and fix what it reports.
3. Apply it with `patch_kage`. Mark each fixed item with `set_critique_priority`.
4. Make the small consistency pass in a second patch.

## Verification
Look once, in one batched round: render a phone width and a desktop width together, collect everything that shows, fix it all in one patch, check once more at most, and stop.

## Done when
No P0 or P1 item is open and lint shows no P0 or P1. Then close that critique (its id, not the latest) with `close_critique`.

## Hand off to
critique again if the changes were large; clarify for the copy.
