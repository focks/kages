Feature: Coherent artifact presentation
  Scenario: Category colors survive changes in layout and value
    Given a donut and treemap with the same declared color domain
    When items are reordered, filtered, or change rank
    Then each retained category keeps the same data color in both charts
    And a containing section palette does not change that data color
    And older pinned chart contracts retain their original appearance

  Scenario: A reader understands the chart's context
    Given a chart with units, takeaway, source and update time
    Then that context is visible outside the marks
    And loading, error and stale states are distinguishable
    And a data table remains available

  Scenario: A native canvas expresses a coherent personality
    Given a canvas with an analytical, editorial, exploratory, teaching or showcase personality
    Then typography and spacing follow that personality
    And the canvas can use the reader theme or an explicit light or dark appearance
    And narrow containers preserve the reading order without page overflow

  Scenario: An author reviews and reverses presentation changes
    Given a readable Kage and a selected presentation personality
    When the author previews polish
    Then the operation returns a proposed patch, preview and advisory findings without writing
    And facts, bindings, events and explicit component references remain unchanged
    When an authorized author applies against the reviewed base version
    Then a new version is created
    And the returned undo patch restores the original presentation in another version
    And stale apply or undo attempts cannot overwrite concurrent edits
