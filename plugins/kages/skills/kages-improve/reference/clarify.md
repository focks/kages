# clarify

Buttons say what they do; errors name the problem and the way out.

## Purpose
Make the words do their job: buttons say what they do, errors say what happened and what to do next.

## Before you start
Call `get_context` with the Kage. The brief's audience and voice, and the workspace's `absent` list, bind your wording.

## Scope
Text props only: titles, labels, descriptions, helper and error text, button labels. Do not change meaning, add claims or numbers, or invent testimonials.

## Steps
1. Read `describe_kage`.
2. Fix, in order: button labels that are not verbs; errors that do not name the problem and the recovery; jargon the audience would not use; headings that do not say what the section is.
3. Keep the brief's voice and vocabulary. Ask before replacing factual copy.
4. Patch with `patch_kage` after `validate_patch`.

## Verification
Look once, in one batched round: render a phone width and a desktop width together, collect everything that shows, fix it all in one patch, check once more at most, and stop. Read every changed string aloud in the audience's voice.

## Done when
Every control names its action and every error names the problem and what to do.

## Hand off to
polish; harden if errors were missing entirely.
