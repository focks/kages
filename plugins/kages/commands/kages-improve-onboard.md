---
description: Orientation, first-run and empty states for a newcomer
argument-hint: <kage>
---

Apply the Kages improve move "onboard" to $ARGUMENTS. Call get_improve_packet {command:"onboard", kage:<the Kage name>} for the playbook and its context, then follow the playbook.

## Purpose
Give a newcomer a first minute: what this is, what to do first, and what an empty screen means.

## Before you start
Call `get_context` with the Kage. If its mode is operate, the first run matters most; if experience, keep it nearly invisible.

## Scope
First-run and empty states, a one-line orientation, and the single primary action. No tours, no pop-ups that block the task.

## Steps
1. Read `describe_kage` and list every block that can start empty.
2. For each, write the empty state: what is missing, why, and one way out.
3. Add a short orientation at the top if the page does not say what it is for, using the audience's words from the brief.
4. Make sure there is exactly one obvious first action. Patch with `patch_kage` after `validate_patch`.

## Verification
Look once, in one batched round: render a phone width and a desktop width together, collect everything that shows, fix it all in one patch, check once more at most, and stop. Read the page as someone who has never seen it.

## Done when
No block opens to nothing, and a newcomer can name the first action in five seconds.

## Hand off to
clarify; critique.
