Feature: Scholarly reading
  A long, sourced page must let the reader check every claim, and must stay data:
  no author text becomes markup, an arbitrary DOM id or an active link.

  Scenario: A citation links to its source
    Given a rich-text run with cite "dora" and a references block listing "dora"
    When the page renders
    Then the run is a superscript link to that reference item
    And the item is numbered by its position in the list

  Scenario: A citation to nothing is reported
    Given a cite run whose id is not in any references block
    Then lint reports dangling-cite
    And a cite run whose number differs from its source's position is also reported

  Scenario: A quotation is attributed outside the quote
    Given a quote node with an attribution and an https href
    Then the attribution is a figcaption beside the blockquote, linked passively
    And a javascript: href is shown as plain text

  Scenario: A figure says what to take from it
    Given a scene or diagram with a label and a caption
    Then the caption is the visible text and the label is the accessible name

  Scenario: Code is coloured without becoming markup
    Given a code block with language "ts"
    Then keywords, strings, numbers and comments are text spans
    And hostile or unterminated source renders as exactly the same text
    And an unknown language is shown plain
    And an input over the size cap is shown plain

  Scenario: Terms and sources are bounded lists
    Given a glossary or references block with more than 200 items
    Then only the first 200 render and items without a usable id are dropped
