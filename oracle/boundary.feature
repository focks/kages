Feature: Authored system-boundary diagrams
  Scenario: Static structured boundaries preserve spatial meaning
    Given a boundary-diagram with asymmetric zones and heterogeneous cards
    And cards contain mixed monospace and sans text, rules and nested cells
    When it renders in any installed system
    Then the drawing uses only token colours and selectable escaped text
    And solid, dashed and dotted routes connect named cards or children
    And endpoints can carry no arrowhead, one arrowhead or two arrowheads
    And phone readers can scroll the figure without scrolling the page sideways

  Scenario Outline: Invalid architecture is reported rather than partly drawn
    Given a boundary-diagram with <problem>
    When the document is validated or rendered
    Then validation reports a boundary finding and rendering shows an alert
    Examples:
      | problem                         |
      | an unknown card or child ID     |
      | a duplicate ID at any depth     |
      | a negative or nonfinite size    |
      | a child outside its parent      |
      | a malformed route waypoint      |

  Scenario: Authored content is not silently lost
    Given a boundary-diagram with an unknown nested key or zero-length route segment
    When it is validated
    Then it reports a boundary finding instead of dropping content or arrowheads

  Scenario: Visual review measures text in its own drawing coordinates
    Given a long line extending outside its boundary card
    When kages screenshot measures the loaded fonts
    Then it reports text extending beyond the card
    And contained phone scrolling alone is not a finding

  Scenario: A pinned workspace design reaches the new form
    Given a boundary-diagram with a pinned workspace design
    When it renders
    Then its canvas and content use the pinned design tokens
    And the technical palette applies only without a workspace design

  Scenario: Paint order never silently hides authored content
    Given sibling cards or children with overlapping rectangles
    When the drawing is validated
    Then it reports boundary-overlap
    And enclosing zone rectangles remain exempt

  Scenario: A valid parent line is covered by a later child
    Given text whose glyph bounds intersect a later opaque child rectangle
    When kages screenshot measures the drawing
    Then it reports the occluded text
    And a rejected boundary drawing is also a screenshot failure

  Scenario: Explicit defaults and meaningful empty boundaries
    Given a zone using style dashed
    Then its dash pitch matches the omitted default
    And a drawing with no zones and no cards is rejected
