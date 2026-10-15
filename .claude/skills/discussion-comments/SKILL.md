---
name: discussion-comments
description: "How comments work in Kages: threaded replies with votes, point comments pinned onto the rendered page (comment mode), resolution and deletion, all permission-checked in the store and exposed as operations. Covers the data model, the pin-as-block-fractions rule, the UI pieces and how to verify them in a real browser. Read before touching src/collab/comments.ts, the comment operations or src/components/dashboard/comments."
---

# Discussion and point comments

Two surfaces over one model:

- **Discussion** (Reddit/forum style): the Detail panel's Discussion tab — threaded
  replies, votes, best/new/old sort, resolved filter.
- **Comment mode** (design-tool style): in the Preview tab (and fullscreen) switch
  on Comment mode (or press `C`), click anywhere, type, post; a numbered pin
  appears at that spot and its thread opens in a popover.

## Model (`src/collab/comments.ts`, `Store` in `src/store/store.ts`)

A `Comment` is the original block note plus optional fields, so old snapshots load
unchanged: `parent` (reply), `pos` (pin), `version`, `editedAt`, `resolved*`,
`deleted` (tombstone) and `votes` (server-only map).

- **A pin is `block` + `pos` as 0..1 fractions of that block's box**, never pixels,
  so it follows the block through responsive layout. Only a thread root can be a pin;
  a reply inherits its parent's block.
- **The anchor must be a block in the stored document.** Repeated items and
  compositions render with runtime ids that are not stored, so the client climbs
  `[data-block]` ancestors until it finds one that exists in `doc.blocks`.
- **Rules live in the store**, not the UI: read needs read access; writing needs a
  signed-in principal (anon can read a public Kage's discussion, never write);
  author-only edit; author-or-admin delete; author-or-writer resolve (thread root
  only); no self-votes; 4000 chars, no NUL, 60 comments/hour, 2000 per Kage, depth 8.
  `commentView` computes `canEdit/canDelete/canResolve/canVote` per viewer, so the UI
  never offers what the server would refuse and clients never see other people's votes.
- **Delete keeps shape**: a comment with replies becomes a tombstone; a childless one
  vanishes (and takes an emptied tombstone above it with it).

## Operations (one table → REST, MCP, OpenAPI, CLI)

`comment` (block?, x?, y?, parent?, text), `list_comments`, `edit_comment`,
`delete_comment`, `resolve_comment`, `vote_comment`. The pin is **flat `x`/`y`** on the
wire; the UI hook translates its `{x,y}` object (a nested `pos` once silently posted
comments without their pin). CLI: `comment <name> <block|-> <text> [--at x,y]`,
`comments`, `reply`, `resolve`, `vote`.

## UI (`src/components/dashboard/comments/`)

- `comment-model.ts` — pure and tested: `buildThreads`, sorts, `pinNumbers` (stable by
  creation order), `visiblePins`, `popoverPlacement`, `fractionIn`.
- `use-comments.ts` — fetch + 20 s poll while visible; every write refreshes and shows
  the server's own error message.
- `comment-thread.tsx` — `Composer`, vote column, recursive `CommentNode`. Comment text
  is rendered as plain pre-wrapped text, never markup (it is untrusted).
- `discussion-panel.tsx` — the tab, including the "About" picker, the keyboard route to
  block-anchored comments.
- `comment-stage.tsx` — comment mode. A transparent overlay swallows clicks so the Kage
  does not react; hit-testing uses `elementsFromPoint`, skipping our own layers. Block
  wrappers are `display: contents`, so a block's rect is the union of its children's.
  Pins live in an overlay *inside* the scrolling content. Esc is handled in the capture
  phase so it peels back draft → thread → mode before the surrounding sheet closes.

## Verify in a real browser

SSR cannot click. Drive Chrome over CDP with real mouse events (`Input.dispatchMouseEvent`)
and check the stored result with `list_comments`, not just the DOM. That is how the
flat-`x`/`y` bug and the wrong-"Reply"-button probe were caught. Votes need a second
principal, so they are covered by the store tests rather than the single-user dev UI.
