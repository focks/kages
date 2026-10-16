---
description: Remove what the page does not need: fewer blocks, same job
argument-hint: <kage>
---

Apply the Kages improve move "distill" to $ARGUMENTS. Call get_improve_packet {command:"distill", kage:<the Kage name>} for the playbook and its context, then follow the playbook.

## Purpose
Remove what the page does not need: fewer blocks, same job.

## Before you start
Call `get_context` with the Kage. Read its brief: what the visitor is trying to do decides what is essential.

## Scope
Structure and repetition: nested containers, blocks that repeat each other, decorative blocks that carry no content, sections that make the same point. Never remove data, state or wiring that something still reads.

## Steps
1. Read `describe_kage` and `lint_kage` (nested-sections, unreachable-block).
2. List what to remove or merge and why each is safe.
3. Try it with `validate_patch`, then apply it in one `patch_kage`.
4. If a container is the only thing that groups content, replace it with spacing and a heading instead.

## Verification
Look once, in one batched round: render a phone width and a desktop width together, collect everything that shows, fix it all in one patch, check once more at most, and stop. Confirm the main task is still one obvious action away.

## Done when
The block count fell, nothing the page needs is lost, and lint is no worse than before.

## Hand off to
polish; quieter if it is still loud.
