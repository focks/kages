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

  # --- the rule registry -----------------------------------------------------

  Scenario: Every lint finding names its rule, severity and tier
    Given a document with a button that has no click handler
    When it is linted
    Then the finding has rule "dead-button", severity "P1" and tier "immediate"

  Scenario: A waiver needs a reason
    Given a document that waives "dead-button" with a reason of at least 8 characters
    When it is linted
    Then the finding is removed from the findings and reported as waived
    But a waiver with a short reason, an unknown rule or no rule waives nothing and reports "bad-waiver"

  Scenario: Findings gate scripts by severity
    When "kages lint" runs on a document with a P0 or P1 finding
    Then it exits 2
    And a document with only P2 or P3 findings exits 0

  Scenario: Boxes inside boxes are reported
    Given a card, or a section with a surface, sunken or accent tone, placed inside another such container
    When it is linted
    Then each inner container is reported once as "nested-sections" (P2) with the chain of ancestors and a fix
    And plain sections, sibling containers, containers inside a modal or a shell region are not

  Scenario: A successful write says what it introduced
    When create_kage, generate_kage or set_kage_brief succeeds
    Then the response carries the Kage's findings as "advice", or ack "clean" when there are none
    When patch_kage succeeds
    Then it carries only the findings that patch introduced, plus counts of fixed and already-existing ones
    And an unrelated later patch does not repeat a finding that was already reported

  Scenario: Quiet and off
    When advice is "quiet"
    Then only findings at or above the severity floor (default P2) are returned, nothing at all when clean
    And "off" returns none, and a refused write always returns its errors and advice in full

  Scenario: An opt-in audit log measures the rules without recording content
    Given the advice log is enabled
    When advice or lint runs
    Then one line is written with counts, rule ids, waived rule ids and timings
    And no title, prop value, comment, brief text or waiver reason ever appears in it
    And "kages advice-log stats" lists each rule's waiver rate so noisy rules are visible

  Scenario: Claims need a source
    Given a persuade or experience Kage that says "Trusted by 500+ teams" or quotes a customer
    When it is linted
    Then "unsourced-claim" reports it, unless brief.evidence records a source for that claim or block
    And a stat with a typed-in value is reported by "stat-literal-unsourced" in operate and persuade
    And a page labelled illustrative is not asked to source its figures, but fabricated testimonials still are
    And when the workspace brief lists testimonials as absent, an unsourced testimonial is P1
