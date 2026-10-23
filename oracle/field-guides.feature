Feature: Chaptered field guides
  Agents compose navigable research guides from validated blocks, never HTML.

  Scenario: A reader follows a chapter link
    Given a root guide declares its chapter slugs and labels
    And the full-page host has enabled chapter navigation
    When the reader opens a URL fragment for a declared chapter
    Then that chapter is selected
    And Back and Forward restore the corresponding chapters
    And the reading canvas receives focus without losing other document state

  Scenario: A phone reader chooses a chapter
    Given the guide is displayed in a narrow container
    When the reader opens the chapter menu and chooses a chapter
    Then the menu closes and the chapter is readable without page overflow
    And Escape closes the menu and returns focus to its toggle

  Scenario: Inspect filtered evidence
    Given a catalog repeats disclosures over a dataset with stable keys
    When the reader filters by topic and title
    Then only matching entries appear
    And an unmatched query exposes a useful empty state
    And clearing filters restores the entries and their expansion state

  Scenario: Chapter messages stay within the artifact's routes
    Given a frame asks to navigate to an undeclared chapter or external URL
    Then the host leaves its location unchanged
    And an embedded guide cannot claim the host's URL fragment
