---
name: slide-decks
description: "The deck form: a Kage that is presented one slide at a time with the deck block — layouts, slide rail, speaker notes, keyboard navigation and the rules for a deck that reads at rest. Read before building any talk, pitch, review or walkthrough Kage. A page to be scrolled is report-kages or answer-pages; this is for something shown."
---

# Slide decks

Use the `deck` block (core 1.20+, ledger 2.17+, atelier 1.16+). It shows one
slide on a fixed-ratio stage with Previous and Next, a rail of slide buttons,
arrow, Page, Home and End keys, and optional speaker notes. The shown slide is
the public output `index`, so a progress label can bind to it. Start from the
`platform-review-deck` example through `get_authoring_guide`.

## Choose it only for a presentation

A reader who scrolls wants `report-kages`. A gallery of unordered pictures is a
`carousel`. Use a deck when the order is the argument, someone will present it,
or the audience will advance it themselves. Set `brief.mode` to `experience`.

## Slide model

`slides` is an array of up to 60 objects. Every field is optional text.

| layout | uses | for |
| --- | --- | --- |
| `title` | eyebrow, title, text | the opening, once |
| `section` | eyebrow, title | a divider between parts |
| `content` (default) | eyebrow, title, text, items, src | one idea with up to 8 short points |
| `split` | eyebrow, title, text, items, src, alt | words beside a picture |
| `quote` | title, quote, cite | one attributed line |
| `stat` | eyebrow, title, value, caption | the one number that matters |

Also `notes` (shown under the stage when the block has `notes:true`),
`ratio` (`16:9` default, `4:3`) and `palette` for a region tint. Strings are
cut at 600 characters and items at 8; the cut is silent, so write inside it.

## The shape of a good deck

1. **Open with the result.** The title slide states what the talk concludes, in
   a line. A reader who sees only slide one is correctly informed.
2. **One idea per slide, stated as the title.** "Median deploy fell from 31 to
   9 minutes" beats "Deploy performance". Items support the title; they do not
   repeat it.
3. **About one slide a minute at most.** Cut before you shrink. Eight short
   items is a ceiling; three is usually right.
4. **Numbers and quotes get their own slide.** Use `stat` for one figure with
   its denominator and period in the caption, and `quote` for one attributed
   line. A figure you cannot source is labelled as an example or removed.
5. **Pictures carry a point.** Use `split` with `src` and a descriptive `alt`.
   Image sources follow the `image` block's passive rules; no remote tracking
   or script URLs.
6. **Notes hold the speaking part.** Put what you would say, sources and
   timings in `notes`; the slide holds only what the audience reads.
7. **End with the ask or the next step**, not "Thank you".

## At rest

The deck is complete without interaction: slide one is visible, and every slide
title is in the rail, so a skimmer sees the whole argument. Do not hide content
behind the second slide that the page's summary needs. If the talk matters
beyond the room, put the same findings in a `report-kages` page and link it.

## Presenting it elsewhere

`export_kage` with `format:"artifact"` turns the deck into a page Claude's Artifact
tool can publish (see `artifact-design`). Pictures must be base64 raster data
there, because remote images are blocked in that frame.

## Review

`render_kage` shows the first slide only. To check others, create temporary
copies with `index` set to each slide, or read the rail. Look for text that
fills the stage edge to edge (shorten it), a title longer than two lines, and a
picture that is cropped away from its point. Follow `visual-review` and
`artifact-design`; one pass, then publish.
