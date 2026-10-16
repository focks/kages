Feature: Feedback from a shared link
  Someone who is sent a link can tell the author what they noticed, without an account.

  Scenario: A reviewer leaves feedback
    Given a Kage is published with link or public visibility
    When a visitor sends their name and a note, optionally about one section
    Then the author sees it in the Kage's discussion as a guest comment
    And the visitor sees only a confirmation, never the author's private discussion

  Scenario: Only feedback, only when open
    Then a guest can add a root comment and nothing else: no edit, delete, resolve, vote or patch
    And feedback is refused for a private, unpublished, unknown or later-unpublished Kage

  Scenario: Limits protect the author
    Then a name and text are required and bounded, control characters are removed, and an unknown section is refused
    And guests share a cap of 50 comments per Kage, and the author can still reply after it is reached

  Scenario: Only a committed comment is acknowledged
    Given the workspace changed concurrently on every attempt to save
    Then the visitor is told to retry (503) and is never given a comment id for a comment that was not saved

  Scenario: Comment mode on a shared page
    When a visitor turns on comment mode and clicks anything on the page
    Then a comment window opens at that spot asking for their name and a note
    And sending it pins the note to that block at that position, shows the visitor their own pin, and delivers it to the author as a guest comment
    And the visitor cannot reply, vote, edit or see anyone else's comments
