Feature: Slide decks
  Scenario: A deck shows one slide at a time on a fixed-ratio stage
    Given a deck with six slides in the title, stat, content, quote, section and content layouts
    When it renders in any installed system
    Then only the current slide is on the stage, labelled "Slide n of 6"
    And the stage keeps a 16:9 ratio, or 4:3 when ratio asks for it
    And every slide title appears in a rail of buttons that jump to that slide
    And speaker notes appear under the stage only when notes is true

  Scenario: Navigation is ordered and keyboard reachable
    Given a deck showing its first slide
    Then Previous is disabled
    And ArrowRight, PageDown and Space go forward, ArrowLeft and PageUp go back
    And Home and End go to the first and last slide
    And moving past either end does nothing
    And every move emits change with the new index, which is the public output index

  Scenario: Slides are data, never markup
    Given slides whose text contains markup or a javascript: image source
    When the deck renders
    Then the text is escaped and no script or javascript: URL reaches the page
    And slides beyond 60, items beyond 8 and strings beyond 600 characters are dropped
    And a deck with no slides shows its empty message
