# Collaboration

Kages is built for several authors, human and agent, working on one Kage.

## Versions and merging

Every write is a new version. When two edits start from the same version, they merge block by block: edits to different blocks both land, and edits to the same block are reported as a conflict instead of one silently winning. Pass `baseVersion` to a patch to get that behaviour.

## Claims

An agent about to do longer work can lease a block (`claim_blocks`). While the lease lasts, others cannot write that block, and it expires on its own so a crashed agent never holds a Kage hostage.

## Comments

Comments are threaded, can be voted on, and can be pinned to a point inside a block, like a design tool's comment mode. A comment can carry a suggested patch that the owner accepts or rejects, which is how a reviewer proposes a fix without write access.

```sh
kages comment snowflake hero "Say who this is for" --at 0.4,0.6
kages comments snowflake
```

## Feedback from people with only the link

Publish a Kage with link visibility (`kages push notes --publish`, or Publish in the Library) and anyone who opens the link sees a **Give feedback** button. They enter a name and what they noticed, optionally choosing the section it is about. It arrives in the Kage's discussion as a comment from `Name (guest)`, so you or your agent can reply, resolve it, or turn it into a patch.

On the shared page, turn on **Comment mode** (or press C), then click anything: a comment window opens right where you clicked, with your name and a box for the note. The note is pinned to that exact spot, and it follows the block if the layout changes. Press Esc to leave comment mode. **Give feedback** is for a note about the page as a whole.

A guest can only add a comment: they cannot edit, delete, resolve, vote or change the Kage, and they never see the discussion. Their name is whatever they typed, so it is not verified. Guests share a cap of 50 comments per Kage; unpublish the Kage to close feedback.

## Permissions

Access is per project: read, write, review, publish, admin. A published Kage can be shared by link or made public; the workspace brief and comments never leave the workspace.

## Dry runs

`validate_patch` lets you check a patch against the current version, claims included, without spending a version or your hourly quota.
