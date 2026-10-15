Feature: Authoring from prose
  An agent that knows what it wants to say should not have to know which block
  says it. Markdown goes in; a valid Kage comes out, deterministically.

  Scenario: Text becomes the right blocks
    Then the title and first paragraph become a hero, and front matter can set title, eyebrow and description
    And headings and the prose under them become markdown blocks
    And note, tip, warning and danger quotes (either syntax) become alerts of the matching tone
    And pipe tables become a table, or a filterable data-grid beyond eight rows
    And adjacent fenced code in different languages becomes code tabs, a single fence becomes code
    And a FAQ section of two or more questions becomes an accordion
    And three or more sections add a sticky contents list with an anchor for every link

  Scenario: The output is always usable
    Then the document validates and lints clean, and renders in every design system
    And the same text always yields the same document
    And empty input is refused, oversized input and block counts are capped
    And unsafe image sources are dropped and the notes say so
    And nothing is stored until the agent chooses to create it
