Feature: Discussion and point comments
  People and agents discuss a Kage the way they discuss a document: threaded
  replies with votes, and point comments pinned onto the rendered page. All rules
  live in the store, so every adapter behaves identically.

  Scenario: A comment is about the Kage, a block, or a point inside a block
    When a reader comments with no block, with a block, or with a block and x/y between 0 and 1
    Then it is stored as a general comment, a block comment or a pin respectively
    And a pin records the version it was written on
    And an unknown block, a position outside 0..1 or a pin without a block is refused

  Scenario: Replies form a thread
    When someone replies to a comment
    Then the reply takes its parent's block and is never itself a pin
    And threads nest to a bounded depth and a deleted comment cannot be replied to

  Scenario: Reading and writing are separate permissions
    Given a Kage visible to a principal
    Then that principal can read its discussion
    And only a signed-in principal can comment, edit, vote, resolve or delete
    And an anonymous visitor to a public Kage can read but never write
    And a principal who cannot see the Kage can do nothing with its comments

  Scenario: Votes rank comments
    When a reader votes up, down or clears
    Then each person has at most one vote per comment, changeable at any time
    And nobody can vote on their own comment
    And clients receive the score and their own vote but never other people's votes

  Scenario: Threads are resolved by their author or an editor
    When a thread's first comment is resolved or reopened
    Then only its author or someone who can write the Kage may do so
    And a reply cannot be resolved on its own

  Scenario: Editing and deleting
    Then only the author can edit a comment
    And the author or an admin can delete it
    And a deleted comment with replies stays as a tombstone so the thread keeps its shape
    And a deleted comment without replies disappears, along with any empty tombstone above it

  Scenario: Limits protect the workspace
    Then comment text is 1 to 4000 characters without NUL
    And an author can post at most 60 comments an hour
    And a Kage holds at most 2000 comments

  Scenario: Discussion follows the Kage
    Then comments persist with the workspace snapshot, including snapshots written before replies, pins and votes existed
    And deleting a Kage deletes its discussion

  Scenario: The pin follows its block
    Given a pin stored as fractions of its block's box
    When the page is resized or laid out differently
    Then the pin stays on the same part of the same block
    And a pin whose block no longer exists is listed in the discussion as orphaned instead of floating on the page

  Scenario: Comment mode
    When a viewer turns comment mode on and clicks anywhere on the rendered Kage
    Then the innermost block under the pointer becomes the anchor with the click position inside it
    And the viewer can type a comment and post it as a pin
    And clicking an existing pin opens its thread to read, reply, vote or resolve
    And resolved threads are hidden from the page unless asked for
    And the Kage itself does not react to clicks while comment mode is on
