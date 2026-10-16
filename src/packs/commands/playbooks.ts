// The nine improvement moves as playbooks an agent follows. Each is plain text with the
// same sections, so an agent learns the shape once. They name only ops and CLI verbs that
// exist: `scripts` and commands.test.ts check every reference against the real tables, so
// a renamed op breaks the build instead of leaving a playbook that points nowhere.
//
// Verification is bounded on purpose: build or fix fully, look once with a batched round
// (a phone width and a desktop width together), fix everything that shows, confirm at most
// once, then stop. Open-ended polishing costs the owner more than it earns.

const BOUNDED = "Look once, in one batched round: render a phone width and a desktop width together, collect everything that shows, fix it all in one patch, check once more at most, and stop.";

export const PLAYBOOKS: Record<string, string> = {
  critique: `## Purpose
Review a Kage the way its audience would meet it, and leave a saved, prioritised backlog.

## Before you start
Call \`get_context\` with the Kage name and follow its directives. If NO_BRIEF is raised, ask the owner for the three brief answers before judging anything against an audience you have invented.

## Scope
One Kage, its current version. You score and judge; Kages only supplies evidence.

## Steps
1. Call \`critique_kage\` for the packet. Render it at 390 and 1200 wide if you can (\`kages critique <name> --screens 390,1200\`).
2. Follow the protocol in the packet: two isolated assessments when you can run sub-agents (kages-critic, then kages-evidence), otherwise one after the other and say DEGRADED.
3. Write the report in the chat: verdict, scores, strengths, three to five priority issues with a fix and a suggested command, persona red flags.
4. Save it with \`save_critique\`, passing the reviewed packet target.digest. A conflict means the Kage changed: refresh the evidence and review it again.

## Verification
${BOUNDED} Do not claim a visual finding the render evidence does not show.

## Done when
The report is in the chat, the critique is saved, and the final message ends with the one question you most need answered.

## Hand off to
polish for the P0 and P1 items; distill if the page is crowded; harden if it breaks on real data.`,

  polish: `## Purpose
Clear the open P0 and P1 items of the latest critique, then make the page consistent.

## Before you start
Call \`get_context\` with the Kage. If CRITIQUE_STALE is raised, the critique is old: run critique first. If there is no critique, run critique first.

## Scope
Only what the backlog and the lint findings name, plus obvious inconsistencies in spacing, wording and variants. No redesign, no new content.

## Steps
1. Read the backlog with \`list_critiques\` and the findings with \`lint_kage\`.
2. Draft one patch for the open P0 and P1 items, then the lint findings. Try it with \`validate_patch\` and fix what it reports.
3. Apply it with \`patch_kage\`. Mark each fixed item with \`set_critique_priority\`.
4. Make the small consistency pass in a second patch.

## Verification
${BOUNDED}

## Done when
No P0 or P1 item is open and lint shows no P0 or P1. Then close that critique (its id, not the latest) with \`close_critique\`.

## Hand off to
critique again if the changes were large; clarify for the copy.`,

  distill: `## Purpose
Remove what the page does not need: fewer blocks, same job.

## Before you start
Call \`get_context\` with the Kage. Read its brief: what the visitor is trying to do decides what is essential.

## Scope
Structure and repetition: nested containers, blocks that repeat each other, decorative blocks that carry no content, sections that make the same point. Never remove data, state or wiring that something still reads.

## Steps
1. Read \`describe_kage\` and \`lint_kage\` (nested-sections, unreachable-block).
2. List what to remove or merge and why each is safe.
3. Try it with \`validate_patch\`, then apply it in one \`patch_kage\`.
4. If a container is the only thing that groups content, replace it with spacing and a heading instead.

## Verification
${BOUNDED} Confirm the main task is still one obvious action away.

## Done when
The block count fell, nothing the page needs is lost, and lint is no worse than before.

## Hand off to
polish; quieter if it is still loud.`,

  harden: `## Purpose
Make the page survive real data and real failures.

## Before you start
Call \`get_context\` with the Kage. Note which blocks bind to data or state.

## Scope
Empty collections, one very long value, many items, missing images, slow or failed loads, narrow screens, and right-to-left text where the audience needs it. Not new features.

## Steps
1. Read \`describe_kage\` and find every block that shows data (tables, charts, lists, stats, forms).
2. For each, decide what the reader sees when it is empty, long, and wrong. Add an empty state or a message where there is none.
3. Make forms validate where the reader types (\`error\` bound to a rule) and say what to do.
4. Patch with \`patch_kage\` after \`validate_patch\`. Render with \`kages screenshot <name> --width 390,1200\`.

## Verification
${BOUNDED} Try the longest realistic label in the narrowest layout.

## Done when
Every data block has a defined empty state, every form error names the problem and the fix, and the narrow render has no sideways scroll.

## Hand off to
adapt for layout; onboard for first-run.`,

  clarify: `## Purpose
Make the words do their job: buttons say what they do, errors say what happened and what to do next.

## Before you start
Call \`get_context\` with the Kage. The brief's audience and voice, and the workspace's \`absent\` list, bind your wording.

## Scope
Text props only: titles, labels, descriptions, helper and error text, button labels. Do not change meaning, add claims or numbers, or invent testimonials.

## Steps
1. Read \`describe_kage\`.
2. Fix, in order: button labels that are not verbs; errors that do not name the problem and the recovery; jargon the audience would not use; headings that do not say what the section is.
3. Keep the brief's voice and vocabulary. Ask before replacing factual copy.
4. Patch with \`patch_kage\` after \`validate_patch\`.

## Verification
${BOUNDED} Read every changed string aloud in the audience's voice.

## Done when
Every control names its action and every error names the problem and what to do.

## Hand off to
polish; harden if errors were missing entirely.`,

  onboard: `## Purpose
Give a newcomer a first minute: what this is, what to do first, and what an empty screen means.

## Before you start
Call \`get_context\` with the Kage. If its mode is operate, the first run matters most; if experience, keep it nearly invisible.

## Scope
First-run and empty states, a one-line orientation, and the single primary action. No tours, no pop-ups that block the task.

## Steps
1. Read \`describe_kage\` and list every block that can start empty.
2. For each, write the empty state: what is missing, why, and one way out.
3. Add a short orientation at the top if the page does not say what it is for, using the audience's words from the brief.
4. Make sure there is exactly one obvious first action. Patch with \`patch_kage\` after \`validate_patch\`.

## Verification
${BOUNDED} Read the page as someone who has never seen it.

## Done when
No block opens to nothing, and a newcomer can name the first action in five seconds.

## Hand off to
clarify; critique.`,

  adapt: `## Purpose
Make the page work at phone, tablet and desktop widths and in dark theme.

## Before you start
Call \`get_context\` with the Kage.

## Scope
Layout, density and overflow. Not content.

## Steps
1. Render with \`kages screenshot <name> --width 390,768,1200\` and again with \`--dark\`. Note every finding it reports: sideways scroll, broken images, tiny text, failed blocks.
2. Fix at the source: choose a grid \`minSize\`, a split \`ratio\` that stacks, shorter labels, a smaller figure, a table that scrolls or becomes a list. Do not add special cases for one width.
3. Patch with \`patch_kage\` after \`validate_patch\`.

## Verification
${BOUNDED}

## Done when
The screenshot checks report no findings at 390, 768 and 1200, light and dark.

## Hand off to
harden; polish.`,

  quieter: `## Purpose
Turn the intensity down one step without changing what the page says.

## Before you start
Call \`get_context\` with the Kage. A persuade page may keep its hero; an operate page should rarely need this.

## Scope
Only the declared knobs: section tone, spacing, display headings, extra primary buttons, grid column width.

## Steps
1. Run \`kages tune <name> --quieter\` (the \`tune_kage\` op) for the dry run and read the knob table.
2. If it is what you meant, apply it with \`--apply\` (or \`tune_kage\` with apply true). Use \`--scope <block>\` to limit it to one region.
3. If the page is still loud, repeat once, or distill. If you overshot, bolder steps it back.

## Verification
${BOUNDED}

## Done when
One primary action per region, one display heading, and no section louder than it needs to be.

## Hand off to
polish; distill; bolder if you overshot.`,

  bolder: `## Purpose
Turn the intensity up one step where the page is timid, without changing what it says.

## Before you start
Call \`get_context\` with the Kage. Mode matters: a persuade or experience page may gain presence; a read or operate page gains hierarchy only.

## Scope
The same declared knobs as quieter, in the other direction. Never add decoration to a tool.

## Steps
1. Run \`kages tune <name> --bolder\` (the \`tune_kage\` op) and read the dry run.
2. Apply with \`--apply\` if it is right. Use \`--scope <block>\` for one region.
3. If the page needs more than a step, that is a design decision: run critique and discuss it with the owner.

## Verification
${BOUNDED}

## Done when
There is one clear focal point and one obvious primary action, and nothing on the page is louder than its purpose.

## Hand off to
polish; critique.`,
};
