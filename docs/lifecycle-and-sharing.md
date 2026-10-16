# Lifecycle and sharing

A Kage moves through a few states on its way from a draft to something you hand out, and its visibility decides who can read it. The two are separate: state is how finished a Kage is, visibility is who may see it.

## States

Every Kage is in one of five states. A published version is immutable — a change always writes a new version — so only the state and visibility of the head can move.

| State | Means |
|-------|-------|
| `draft` | Being worked on; visible only inside the project |
| `review` | Submitted for another author to look at |
| `published` | Released and shareable at its visibility |
| `deprecated` | Still renders, but flagged as superseded |
| `archived` | Put away; hidden from the default listing |

Deletion is not a state. It removes the Kage and its history from the workspace, keeping only an audit record of who removed it.

## Changing state

Each move is one operation, and each needs a grant on the project. Archiving a draft only needs `write`; archiving something already published needs `publish`, since it takes shared content offline.

| Command | Move | Needs |
|---------|------|-------|
| `kages review` | draft to review | write |
| `kages publish` | draft or review to published | publish |
| `kages unpublish` | published back to draft | publish |
| `kages deprecate` | published to deprecated | write |
| `kages archive` | any state to archived | write or publish |
| `kages restore` | archived or deprecated to published | publish |
| `kages delete` | remove entirely | admin |

Unpublishing and archiving reset visibility to private, so restoring an old Kage never silently re-exposes something that used to be public. Delete asks for `--yes`, because it cannot be undone.

## Visibility

Visibility is set when you publish and changed with the `share_kage` operation. A Kage is private until you choose otherwise; nothing widens on its own.

| Level | Who can read |
|-------|--------------|
| `private` | People with a grant on the project |
| `workspace` | Anyone in the workspace |
| `link` | Anyone who has the link, no sign-in |
| `public` | Anyone, and it is listed |

```sh
kages publish weekly-report --visibility link
```

## Share links

A shareable Kage has a link at `/k/<uuid>`. The link uses the Kage's opaque id, not its name, so it does not reveal the title and cannot be guessed. The id is minted once when the Kage is created and stays the same across every version, so a link you hand out keeps working as the Kage is revised. Published link and public Kages are mirrored into a registry that resolves a `/k/<uuid>` across workspaces, so a reader never needs to know whose workspace holds it.

## Comments and guest feedback

Someone opening a share link sees a clean, full-page render in the Kage's own design system, with no editing. If the author turns on comment mode, a link visitor can leave feedback pinned to a place on the page without an account. Authors and signed-in collaborators get the fuller threaded discussion — replies, votes and resolution — covered in [collaboration](collaboration.md).

## Permissions

Access is granted per project, with five grants: `read`, `write`, `review`, `publish` and `admin`. Each of the others implies read. The first person to create a Kage in an unclaimed project becomes its admin, which is how a fresh project gets an owner. When an agent acts on behalf of a person, the effective permission is the intersection of the two, so an agent can never exceed the authority of the person it works for.
