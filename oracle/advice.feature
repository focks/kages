Feature: Advice and lint for authors
  An agent that gets a validation result should know what to change, and should
  be warned about mistakes that are valid but wrong. None of this changes whether a
  document is valid, and the validator's own findings stay exactly as they are.

  Scenario: Every finding comes with a fix
    Given a document the validator rejects
    Then each finding gets a hint that names the nearest valid type, prop, slot, event, command, block, state key, source or action
    And a private output read names the outputs that can be read and the state route
    And hints are advice, never a replacement for the validator's own message

  Scenario: Pitfalls the validator allows are reported as lint
    Then a button with no click handler, a form with no submit handler and a modal nothing opens are reported
    And a table of contents link without an anchor, a tab without its panel and duplicate item ids are reported
    And a template reading a private output or an undeclared state key is reported, since it renders empty
    And insecure media sources, empty unbound charts and an invalid calendar month are reported
    And an interactive chart whose selection nobody reads is reported
    And a block that no slot leads to is reported

  Scenario: Shipped documents are clean
    Then every example and starter produces no advice and no lint

  Scenario: A rejected write explains itself
    When create or patch is refused for invalid content
    Then the error carries the findings and the advice, over REST, MCP and the CLI
    And validate_kage returns validation, advice and lint together
