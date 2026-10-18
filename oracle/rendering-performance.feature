Feature: Fast first paint and large pages
  An artifact should appear quickly the first time, instantly on a repeat view, and stay responsive as a page grows.

  Scenario: The frame fetches its files in parallel
    Given a frame for a document that pins a design-system folder
    Then the frame head preloads the pinned styles and script with their integrity before the runtime script
    And it requests the web-font stylesheet that the bundle imports
    And a folder outside /ds is not preloaded

  Scenario: Hashed files are cached for good
    Given a file under /ds/versions/<hash>/ or /runtime/<hash>.js
    Then it is served with a one-year immutable cache header
    And /ds/bundle.js and the runtime manifest are not

  Scenario: Long repeated lists stay cheap to lay out
    Given a repeat of thousands of cards
    Then instances of the repeat may be skipped by the browser until near the viewport
    And a card that is not part of a repeat is never skipped

  Scenario: Expansion grows with the number of rows
    Given a repeat of N rows and a repeat of 4N rows
    Then expanding and rendering the larger takes about four times as long, not sixteen

  Scenario: A full-page screenshot shows the whole page
    Given an artifact taller than the browser window
    Then the capture contains every block, not blank space below the first screen
