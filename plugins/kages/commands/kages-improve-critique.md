---
description: Review a Kage with evidence and a rubric; save a prioritised backlog
argument-hint: <kage>
---

Apply the Kages improve move "critique" to $ARGUMENTS. Call get_improve_packet {command:"critique", kage:<the Kage name>} for the playbook and its context, then follow the playbook.

## Purpose
Review a Kage the way its audience would meet it, and leave a saved, prioritised backlog.

## Before you start
Call `get_context` with the Kage name and follow its directives. If NO_BRIEF is raised, ask the owner for the three brief answers before judging anything against an audience you have invented.

## Scope
One Kage, its current version. You score and judge; Kages only supplies evidence.

## Steps
1. Call `critique_kage` for the packet. Render it at 390 and 1200 wide if you can (`kages critique <name> --screens 390,1200`).
2. Follow the protocol in the packet: two isolated assessments when you can run sub-agents (kages-critic, then kages-evidence), otherwise one after the other and say DEGRADED.
3. Write the report in the chat: verdict, scores, strengths, three to five priority issues with a fix and a suggested command, persona red flags.
4. Save it with `save_critique`, passing the reviewed packet target.digest. A conflict means the Kage changed: refresh the evidence and review it again.

## Verification
Look once, in one batched round: render a phone width and a desktop width together, collect everything that shows, fix it all in one patch, check once more at most, and stop. Do not claim a visual finding the render evidence does not show.

## Done when
The report is in the chat, the critique is saved, and the final message ends with the one question you most need answered.

## Hand off to
polish for the P0 and P1 items; distill if the page is crowded; harden if it breaks on real data.
